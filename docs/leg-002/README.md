# LEG-002 Handoff

LEG-002 documents and prototypes the async legal ZIP export pipeline.

## Branch Scope

- ADR: `/docs/adr/leg-002-async-zip.md`
- Migration: `/db/migrations/20260609170000_leg_002_zip_jobs.sql`
- Policy/prototype helpers: `/lib/legal/zip-jobs.ts`
- Tests: `/tests/lib/legal/zip-jobs.test.ts`

## Decisions

- Backblaze B2 is the object store.
- Export key is `legal-exports/{tokenId}/{studyId}.zip`.
- Signed URL TTL is 7 days.
- B2 lifecycle is hide after 7 days, delete hidden file after 1 additional day.
- Supabase `zip_jobs` is the durable queue and state machine.
- `pg_net` or Edge Function only wakes the worker.
- The worker is a portable Node.js process.
- `yazl` is used for the large ZIP path because ZIP64 support is required.
- `fflate` is not approved for 20GB-100GB legal exports.
- No Redis/Celery for MVP.
- Production worker runtime must be BAA-covered before PHI use.

## Completed In This Branch

- ADR with B2/yazl architecture and LEG-304 handoff.
- `zip_jobs` migration with required ticket fields and B2 metadata fields.
- Deterministic tests for dynamic part size, pre-flight size cap, dedupe
  expiration behavior, retry planning, object-key safety, and SKIP LOCKED SQL.
- Local 500MB synthetic ZIP stream run with multipart counting sink:
  `524288000` synthetic input bytes, `524376598` ZIP bytes, `101` parts,
  `11062688` peak heap bytes.

## Remaining Environment-Gated DoD

- Run the 500MB synthetic streaming ZIP-to-B2 prototype with non-production B2
  credentials.
- Record peak memory from that live upload.
- Confirm production worker runtime BAA coverage before any PHI processing.
- Update LEG-304 in Jira to reference the ADR before sprint entry.
