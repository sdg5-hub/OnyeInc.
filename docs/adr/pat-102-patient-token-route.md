# PAT-102: Patient Token Route and Short URL Handler

Status: Proposed

## Decision

PAT-102 implements the patient SMS short-link route as a Next.js App Router
server page at `/v/[token]`. The route validates the token server-side before
rendering patient-facing UI. Valid, unexpired, unrevoked tokens redirect to
`/verify/[token]`, which is owned by PAT-201.

The plaintext URL token is treated as a credential. It is hashed immediately
using the IC-203-compatible token hashing helper before lookup and is never
logged, included in audit rows, or sent to observability tooling.

## Scope

PAT-102 owns:

- `/v/[token]` server-side route.
- Token hash lookup through the `pat_102_patient_token_context` database view.
- DB-backed rate limiting at more than 10 requests/minute per IP hash.
- `PATIENT_LINK_ACCESSED` audit logging for all outcomes.
- Shared patient-facing error UI for expired, revoked, invalid/not found, and
  rate-limited states.
- Sentry/log redaction helpers for `/v/[token]` and `/verify/[token]` paths.

PAT-102 does not own:

- SMS delivery; PAT-101 owns SMS.
- DOB verification/session behavior; PAT-201 owns `/verify/[token]`.
- IC-203 token table creation or token issuance.
- One-time-use semantics unless IC-203 later defines them.

## Database Contract

IC-203 must expose a view named `pat_102_patient_token_context`:

```sql
token_hash text
token_id uuid
facility_name text
expires_at timestamptz
revoked_at timestamptz null
```

PAT-102 adds:

- `audit_log` support columns for `PATIENT_LINK_ACCESSED`.
- `patient_link_rate_limits`.
- `pat_102_record_rate_limit_hit(...)` RPC for atomic one-minute IP-hash rate
  limiting.

## Outcomes

- `VALID`: audit with `tokenId`, redirect to `/verify/[token]`.
- `EXPIRED`: audit with `tokenId`, render exact expired copy with facility name.
- `REVOKED`: audit with `tokenId`, render exact revoked copy with facility name.
- `NOT_FOUND`: audit with `tokenId=null`, render generic invalid/used copy.
- `RATE_LIMITED`: audit with `tokenId=null` when lookup is skipped, render
  friendly rate-limit copy.

## Security Notes

- The token is not shortened to satisfy the URL-length note. A 256-bit
  base64url token is about 43 characters, so the full URL may exceed 60
  characters depending on domain length.
- In-memory rate limiting is not used as the primary implementation because
  Render multi-instance deployments do not share process memory.
- Sentry should keep `sendDefaultPii=false` and apply the redaction helper to
  events, breadcrumbs, transactions, tags, messages, and span data where the SDK
  supports hooks for those fields.

## Source Links

- Next.js Dynamic Route Segments:
  https://nextjs.org/docs/app/api-reference/file-conventions/dynamic-routes
- Next.js redirect():
  https://nextjs.org/docs/app/api-reference/functions/redirect
- OWASP Logging Cheat Sheet:
  https://cheatsheetseries.owasp.org/cheatsheets/Logging_Cheat_Sheet.html
- Sentry JavaScript Options:
  https://docs.sentry.io/platforms/javascript/configuration/options/
- Sentry JavaScript Filtering:
  https://docs.sentry.io/platforms/javascript/configuration/filtering/
- Sentry Advanced Data Scrubbing:
  https://docs.sentry.io/security-legal-pii/scrubbing/advanced-datascrubbing/
