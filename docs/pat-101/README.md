# PAT-101 Handoff

PAT-101 adds the server-side SMS notification path for patient imaging-ready
links.

## Key Files

- ADR: `/docs/adr/pat-101-sms-notification.md`
- Internal route: `/app/api/internal/pat-101/send-sms/route.ts`
- SMS service: `/lib/patient-sms/`
- Migration section: `/db/migrations/db_migration_2026_0_0.sql`
- Tests: `/test/lib/patient-sms/service.test.ts` and
  `/test/api/patient-sms-route.test.ts`

## Runtime Environment

Required Railway secrets:

- `PAT101_INTERNAL_WEBHOOK_SECRET`
- `PAT101_APP_BASE_URL`
- `SUPABASE_URL`
- `SUPABASE_SERVICE_ROLE_KEY`
- `TWILIO_ACCOUNT_SID`
- `TWILIO_AUTH_TOKEN`
- `TWILIO_MESSAGING_SERVICE_SID` or `TWILIO_FROM_NUMBER`

## External DoD Still Required

- Configure Twilio sender or Messaging Service.
- Complete A2P 10DLC or toll-free verification.
- Confirm Twilio BAA, Messaging eligibility, and message redaction/privacy
  settings.
- Install the Supabase `pg_net` trigger once IC-202/IC-203 study/token schema is
  finalized.
- Run staging E2E test: COMPLETE transition to SMS receipt within 30 seconds.
- Verify idempotency in Twilio dashboard message logs.
