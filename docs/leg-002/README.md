# LEG-002 Handoff

LEG-002 documents and prototypes the async legal ZIP export pipeline.

## Branch Scope

- ADR: `/docs/adr/leg-002-async-zip.md`
- Migration: `/db/migrations/20260609170000_leg_002_zip_jobs.sql`
- Policy/prototype helpers: `/lib/legal/zip-jobs.ts`
- Live B2 sink: `/lib/legal/b2-sink.ts`
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
- Real Postgres integration test passed for:
  - deduplication: two `zip_jobs` rows pointing at one object key/file id
  - concurrency: two workers claiming distinct jobs via
    `SELECT ... FOR UPDATE SKIP LOCKED`
- Live Backblaze B2 upload script added at:
  `/scripts/leg-002-b2-live-prototype.ts`
- Live Backblaze B2 synthetic upload passed against
  `onye-leg-002-synthetic-test`: `524288000` synthetic input bytes,
  `524376598` ZIP bytes, `101` parts, `12687144` peak heap bytes.

## Remaining Environment-Gated DoD

- Confirm production worker runtime BAA coverage before any PHI processing.
- Update LEG-304 in Jira to reference the ADR before sprint entry.

## Live B2 Prototype Command

Set the B2 variables from `.env.example`, then run:

```bash
./node_modules/.bin/sucrase-node scripts/leg-002-b2-live-prototype.ts
```

Do not point this at production PHI buckets. Use a non-production B2 bucket and
synthetic data only.
