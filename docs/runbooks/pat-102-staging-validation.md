# Runbook: PAT-102 Staging Validation

Use this after PAT-102 is reviewed, merged, and deployed to staging.

## Prerequisites

- PAT-102 migration is applied, including `share_tokens`,
  `pat_102_patient_token_context`, `patient_link_rate_limits`, and
  `audit_log`.
- PAT-102 placeholder route `/verify/[token]` is deployed. PAT-201 can replace
  the placeholder later without changing `/v/[token]` behavior.
- Render service has Supabase and hashing/audit secrets configured.
- Sentry staging is enabled with token path redaction.

## Seed Staging Tokens

Create valid, expired, and revoked staging tokens:

```bash
SUPABASE_URL="https://<project>.supabase.co" \
SUPABASE_SERVICE_ROLE_KEY="<service-role-key>" \
PATIENT_TOKEN_HASH_SECRET="<same-secret-used-by-render>" \
npm run pat102:seed
```

The command prints `/v/<token>` URLs for staging validation. Store them in a
secure staging note only; do not commit them.

## Test Matrix

| Outcome | Action | Expected Evidence |
|---|---|---|
| `VALID` | Open `/v/<valid-token>`. | Redirects to `/verify/<token>` within 500ms p95; audit row has `VALID`. |
| `EXPIRED` | Open `/v/<expired-token>`. | Exact expired copy renders with facility name; audit row has `EXPIRED`. |
| `REVOKED` | Open `/v/<revoked-token>`. | Exact revoked copy renders with facility name; audit row has `REVOKED`. |
| `NOT_FOUND` | Open `/v/<random-token>`. | Generic invalid/used copy renders; audit row has `NOT_FOUND` and `token_id=null`. |
| `RATE_LIMITED` | Send more than 10 requests/minute from same IP. | Friendly rate-limit copy renders; audit row has `RATE_LIMITED`. |

## Mobile Check

Open each error state at 375px viewport width and confirm:

- No horizontal scroll.
- No text overflow.
- OnyeSync logo visible.
- Support link visible and tappable.

## Sentry Check

Trigger a staging event from `/v/<token>` and `/verify/<token>`. Confirm the
plaintext token is absent from:

- `request.url`
- breadcrumbs
- transaction names
- tags
- error messages
- span data where supported by the installed SDK

PAT-102 full DoD is complete only after this staging evidence is captured.
