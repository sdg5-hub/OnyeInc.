# LEG-002: Async ZIP Pipeline Architecture

**Status:** Proposed / spike-ready  
**Date:** 2026-06-09  
**Related tickets:** LEG-000, LEG-001, LEG-101, LEG-201, LEG-304

## Context

Legal users need downloadable DICOM ZIP exports after the legal payment gate.
These studies can be too large for synchronous request-time assembly, so LEG-002
defines an asynchronous pipeline before LEG-304 is built.

This ADR supersedes any LEG-002 draft language that referenced Cloudflare R2 or
`fflate`. The MVP storage target is Backblaze B2, consistent with LEG-000, and
the large ZIP path uses `yazl` because ZIP64 support is required for 20GB-100GB
radiology exports.

## Decision

Use a Supabase-backed durable job table and a portable Node.js worker:

1. The verified Stripe webhook sets `share_tokens.legalAccessPaid = true`.
2. The webhook inserts a `zip_jobs` row with `status = PENDING`, `token_id`,
   and `study_id`.
3. A Supabase trigger, `pg_net`, or Edge Function wakes the worker over
   `POST /internal/zip-jobs/process`.
4. The worker claims one job with `SELECT ... FOR UPDATE SKIP LOCKED`.
5. The worker performs a B2 pre-flight list under the study source prefix and
   stores `study_size_bytes`.
6. Studies over 20GB produce a structured engineering warning.
7. Studies over 100GB fail immediately with:
   `Study exceeds 100GB maximum ZIP size. Contact support for manual delivery.`
8. The worker streams B2 source objects into `yazl` with `compress: false`.
9. The ZIP stream is uploaded to Backblaze B2 using large-file upload parts.
10. The completed ZIP is stored at exactly
    `legal-exports/{tokenId}/{studyId}.zip`.
11. The job is set to `COMPLETE` with `object_key`, `b2_file_id`,
    `zip_size_bytes`, `download_url`, `download_url_expires_at`, and
    `object_expires_at`.
12. A Supabase trigger on `zip_jobs.status = COMPLETE` calls an Edge Function
    that sends the download email through the approved email provider.

`pg_net` and Edge Functions are triggers only. They are not the durable queue and
they do not assemble ZIP files. `zip_jobs` is the system of record for status,
retry, locking, and auditability.

## Out Of Scope

- Redis or Celery.
- Synchronous ZIP generation inside a Next.js request handler.
- Supabase Edge Function ZIP assembly.
- Cloudflare R2 for LEG-002.
- `fflate` for the large legal export path.
- Production PHI processing on a worker runtime without BAA coverage.

## Storage And Lifecycle

Backblaze B2 is the LEG-002 object store. The export key is:

```text
legal-exports/{tokenId}/{studyId}.zip
```

`tokenId` and `studyId` must be opaque internal identifiers. Object keys are
metadata and must not contain patient names, dates of birth, MRNs, accession
numbers, attorney names, firm names, case references, or raw DICOM metadata.

Download authorization TTL is 7 days. B2 lifecycle for the `legal-exports/`
prefix must hide exports after 7 days and delete hidden files after 1 additional
day, producing an 8-day cleanup window.

## Worker Runtime And BAA

The worker reads PHI-containing DICOM/PDF files and writes a PHI-containing ZIP,
so the production worker runtime is in the PHI path. Railway can be used only if
the exact production worker environment is confirmed as BAA-covered and approved
by compliance. Until then, the prototype may run locally or against synthetic
data, but production PHI deployment remains blocked.

The same BAA/vendor check applies to B2, Supabase, the worker runtime, Stripe,
and the email provider. Download emails must avoid PHI unless the email provider
and email content policy are explicitly approved for PHI.

## B2 Large-File Upload Strategy

The worker must calculate upload part size before starting the B2 large-file
upload:

```ts
partSizeBytes = Math.ceil(studySizeBytes / 9000)
partSizeBytes = roundUpToNearestMiB(partSizeBytes)
partSizeBytes = Math.max(partSizeBytes, 5 * 1024 * 1024)
```

Using 9,000 as the planning divisor leaves margin below the 10,000-part ceiling.
The worker uploads each part with the required checksum and only marks the job
`COMPLETE` after the B2 finish call succeeds. On failure, the worker aborts the
unfinished B2 large-file upload where possible and leaves no partial ZIP marked
usable.

## Deduplication

Before inserting a new assembly job, the webhook checks for a completed job with
the same `study_id`. Reuse is allowed only when the object still supports a full
new 7-day access window:

```sql
object_expires_at >= now() + interval '7 days'
```

When the rule passes, insert a second `zip_jobs` row with `status = COMPLETE`
that references the same `object_key`, `b2_file_id`, and `zip_size_bytes`. If the
existing `download_url` does not have a full 7 days remaining, generate a fresh
signed URL for the same object and store the new `download_url_expires_at`.

Do not dedupe solely on `completed_at + interval '7 days' > now()`, because that
can hand a new legal recipient an already-expiring URL or object.

## Worker Concurrency

The MVP worker processes one job at a time per worker instance and polls every
10 seconds as a fallback if the wake trigger is missed. Job claiming uses a short
transaction:

```sql
begin;

select id
from zip_jobs
where status = 'PENDING'
  and (scheduled_retry_at is null or scheduled_retry_at <= now())
order by created_at asc
for update skip locked
limit 1;

update zip_jobs
set status = 'PROCESSING',
    started_at = now(),
    locked_at = now(),
    worker_id = :worker_id
where id = :job_id;

commit;
```

ZIP assembly runs outside the transaction. Multiple worker instances may run
later; `SKIP LOCKED` prevents duplicate processing of the same job.

## Error Handling

On transient failure:

1. Increment `retry_count`.
2. Store `failure_reason`.
3. If the new `retry_count < 3`, set `status = PENDING` and
   `scheduled_retry_at = now() + interval '5 minutes'`.
4. If the new `retry_count >= 3`, keep `status = FAILED` and fire an engineering
   alert.

The worker also stores `last_heartbeat_at`, `locked_at`, and `worker_id` so an
operator can detect stale processing jobs.

## Memory Safety

The worker must stream only. It must not buffer the full study or full ZIP.

Controls:

- Use Node streams and backpressure-aware pipelines.
- Use `yazl` streaming ZIP output with `compress: false`.
- Buffer only the current B2 upload part.
- Check heap usage every 100 files.
- Abort and fail the job if heap exceeds 480MB.
- Record peak memory in the prototype notes.

## Schema

The migration creates `zip_job_status` and `zip_jobs` with the ticket-required
fields plus B2, expiry, and worker-lock metadata. See:

```text
/db/migrations/20260609170000_leg_002_zip_jobs.sql
```

Key additions beyond the original ticket:

- `object_key`
- `b2_file_id`
- `download_url_expires_at`
- `object_expires_at`
- `source_prefix`
- `part_size_bytes`
- `part_count`
- `worker_id`
- `locked_at`
- `last_heartbeat_at`
- `deduped_from_job_id`
- `completed_object_etag`
- `warning_reason`
- `alert_sent_at`

## Prototype Requirements

The feature branch must include deterministic tests and an environment-gated
streaming prototype:

- 500MB synthetic study streams through `yazl` into a B2 large-file upload
  implementation, with peak memory documented.
- Mock 60GB study calculates a part size greater than 5MB.
- Mock 110GB study fails before assembly.
- Two webhook calls for the same study reuse one B2 object when
  `object_expires_at >= now() + interval '7 days'`.
- Two simultaneous worker triggers do not process the same job because of
  `SELECT ... FOR UPDATE SKIP LOCKED`.
- Retry behavior requeues after 5 minutes while `retry_count < 3` and becomes
  permanent failure on the third failed attempt.
- Memory guard fails the job over 480MB.

The live B2 500MB test requires non-production B2 credentials and synthetic data.
If credentials are unavailable, the code-level prototype and mock tests can be
committed, but the live upload result remains an open DoD item.

Local synthetic prototype result from this branch:

```text
command: ./node_modules/.bin/sucrase-node scripts/leg-002-zip-prototype.ts
syntheticInputBytes: 524288000
zipSizeBytes: 524376598
partSizeBytes: 5242880
partCount: 101
filesAdded: 500
peakHeapBytes: 11062688
```

This result proves the local stream bridge and multipart chunking path without
live B2 credentials. The live B2 upload remains environment-gated.

## LEG-304 Handoff

LEG-304 implementation must follow this ADR:

- Use Backblaze B2, not R2.
- Use `yazl`, not `fflate`, for large legal ZIP exports.
- Keep ZIP assembly asynchronous.
- Treat Supabase as durable state, not merely a webhook relay.
- Require BAA-covered runtime before processing production PHI.

## Sources

- Backblaze B2 large files:
  https://www.backblaze.com/docs/cloud-storage-large-files
- Backblaze B2 download authorization:
  https://www.backblaze.com/apidocs/b2-get-download-authorization
- Backblaze B2 lifecycle rules:
  https://www.backblaze.com/docs/cloud-storage-lifecycle-rules
- Backblaze B2 bucket/object key guidance:
  https://www.backblaze.com/docs/cloud-storage-buckets
- Backblaze B2 JavaScript SDK guidance:
  https://www.backblaze.com/docs/cloud-storage-use-the-aws-sdk-for-javascript-v3-with-backblaze-b2
- Supabase database webhooks:
  https://supabase.com/docs/guides/database/webhooks
- Supabase pg_net:
  https://supabase.com/docs/guides/database/extensions/pg_net
- Supabase Edge Functions:
  https://supabase.com/docs/guides/functions
- Supabase HIPAA projects:
  https://supabase.com/docs/guides/platform/hipaa-projects
- yazl README:
  https://github.com/thejoshwolfe/yazl
- PKWARE ZIP APPNOTE:
  https://pkware.cachefly.net/webdocs/casestudies/APPNOTE.TXT
- Node.js backpressure:
  https://nodejs.org/learn/modules/backpressuring-in-streams
- PostgreSQL SELECT locking:
  https://www.postgresql.org/docs/current/sql-select.html
- Railway compliance:
  https://docs.railway.com/enterprise/compliance
