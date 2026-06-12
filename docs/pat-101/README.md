# PAT-101 Handoff

PAT-101 adds the server-side SMS notification path for patient imaging-ready
links.

## Key Files

- ADR: `/docs/adr/pat-101-sms-notification.md`
- Internal route: `/app/api/internal/pat-101/send-sms/route.ts`
- SMS service: `/lib/patient-sms/`
- Migration section: `/db/migrations/db_migration_2026_0_0.sql`
- Supabase trigger handoff: `/docs/pat-101/supabase-trigger.sql`
- Staging validation runbook: `/docs/runbooks/pat-101-staging-validation.md`
- Smoke test script: `/scripts/pat-101-smoke-test.mjs`
- Tests: `/test/lib/patient-sms/service.test.ts` and
  `/test/api/patient-sms-route.test.ts`

## Runtime Environment

Required Render service environment secrets:

- `PAT101_INTERNAL_WEBHOOK_SECRET`
- `PAT101_APP_BASE_URL`
- `SUPABASE_URL`
- `SUPABASE_SERVICE_ROLE_KEY`
- `TWILIO_ACCOUNT_SID`
- `TWILIO_AUTH_TOKEN`
- `TWILIO_MESSAGING_SERVICE_SID` or `TWILIO_FROM_NUMBER`

## Staging Smoke Test

After PAT-101 is deployed to Render, verify endpoint routing before the full
status-transition test:

```bash
PAT101_SMOKE_BASE_URL="https://<render-staging-url>" \
PAT101_INTERNAL_WEBHOOK_SECRET="<staging-secret>" \
PAT101_SMOKE_STUDY_ID="<study-uuid>" \
npm run pat101:smoke
```

Use `/docs/runbooks/pat-101-staging-validation.md` for the full external DoD
evidence checklist.

## External DoD Still Required

- Configure Twilio sender or Messaging Service.
- Complete A2P 10DLC or toll-free verification.
- Confirm Twilio BAA, Messaging eligibility, and message redaction/privacy
  settings.
- Install the Supabase `pg_net` trigger once IC-202/IC-203 study/token schema is
  finalized.
- Run staging E2E test: COMPLETE transition to SMS receipt within 30 seconds.
- Verify idempotency in Twilio dashboard message logs.
