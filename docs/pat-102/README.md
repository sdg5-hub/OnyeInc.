# PAT-102 Handoff

PAT-102 adds the patient SMS short-link route and validation layer.

## Key Files

- Route: `/app/v/[token]/page.tsx`
- Error UI: `/components/patient-token-error.tsx`
- Validation helpers: `/lib/patient-token/`
- Sentry redaction helper: `/lib/observability/sentry-redaction.ts`
- Migration section: `/db/migrations/db_migration_2026_0_0.sql`
- ADR: `/docs/adr/pat-102-patient-token-route.md`
- Staging runbook: `/docs/runbooks/pat-102-staging-validation.md`
- Tests: `/test/lib/patient-token/validate.test.ts` and
  `/test/components/patient-token-error.test.tsx`

## Runtime Environment

Required:

- `SUPABASE_URL` or `NEXT_PUBLIC_SUPABASE_URL`
- `SUPABASE_SERVICE_ROLE_KEY`

Recommended for production parity:

- `PATIENT_TOKEN_HASH_SECRET` or `IC203_TOKEN_HASH_SECRET`
- `PAT102_AUDIT_HASH_SECRET` or `AUDIT_HASH_SECRET`
- `PAT102_SUPPORT_URL`

## External DoD Still Required

- IC-203 provides the `pat_102_patient_token_context` view.
- PAT-201 route exists at `/verify/[token]`.
- Route is deployed to staging Render.
- Staging validates all five audit outcomes.
- Sentry staging confirms token-bearing `/v/[token]` and `/verify/[token]`
  paths are scrubbed from events, breadcrumbs, transaction names, tags,
  messages, and span data where supported by the SDK.
