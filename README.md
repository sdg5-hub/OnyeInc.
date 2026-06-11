# LEG-002 Async ZIP Pipeline Handoff

This branch adds the LEG-002 async legal ZIP export architecture spike.

Key files:

- ADR: `docs/adr/leg-002-async-zip.md`
- Handoff README: `docs/leg-002/README.md`
- Release migration: `db/migrations/db_migration_2026_0_0.sql`
- ZIP job policy helpers: `lib/legal/zip-jobs.ts`
- Synthetic streaming ZIP prototype: `lib/legal/zip-prototype.ts`
- Live B2 synthetic upload sink: `lib/legal/b2-sink.ts`
- Tests: `tests/lib/legal/`

Key decisions:

- Backblaze B2, not R2.
- `yazl`, not `fflate`, for the large legal export ZIP path.
- Supabase `zip_jobs` is durable state.
- No Redis/Celery for MVP.
- Worker runtime must be BAA-covered before production PHI use.

LEG-002 validation performed on this branch:

- `npm run test`
- `npm run lint`
- `npm run build`
- Local 500MB synthetic ZIP stream into multipart counting sink
- Real Postgres integration test for dedupe and `SELECT ... FOR UPDATE SKIP LOCKED`

Live B2 upload command, after non-production B2 env vars are set:

```bash
./node_modules/.bin/sucrase-node scripts/leg-002-b2-live-prototype.ts
```

---

# LEG-001 Branch Handoff

This branch includes the Legal Portal Token Route and Payment Gate ADR and
README handoff for LEG-001 from the release branch.

Key files:

- `docs/adr/leg-001-portal-flow.md`
- `docs/leg-001/README.md`

Summary:

- Legal access uses bearer-link possession plus $35 payment entitlement, not DOB/OTP.
- `/legal/[token]` is the only raw-token entry route.
- Post-payment viewer route is tokenless: `/legal/viewer`.
- `legalAccessPaid` is set only by verified Stripe webhook.
- Legal session cookie is issued only by app route after DB confirms paid + valid token.
- Token forwarding is accepted MVP behavior, sequential only, with anomaly detection/manual review.

Jira tickets LEG-101 through LEG-304 should reference
`docs/adr/leg-001-portal-flow.md` before sprint.
