# Runbook: PAT-102 Staging Validation

Use this after PAT-102 is reviewed, merged, and deployed to staging.

## Prerequisites

- IC-203 token table is present.
- `pat_102_patient_token_context` view exists with `token_hash`, `token_id`,
  `facility_name`, `expires_at`, and `revoked_at`.
- PAT-201 route `/verify/[token]` exists or a staging placeholder route is
  available.
- Render service has Supabase and hashing/audit secrets configured.
- Sentry staging is enabled with token path redaction.

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
