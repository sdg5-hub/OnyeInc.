# LEG-001: Legal Portal Token Route and Payment Gate

Status: ADR ready / implementation pending

Primary ADR: `docs/adr/leg-001-portal-flow.md`

Branch: `LEG-001-legal-portal-token-payment-flow`

## Scope

LEG-001 defines the Legal persona entry route, Stripe payment gate, legal entitlement flag, legal session cookie, forwarding policy, anomaly detection model, and viewer-routing decisions required before LEG-101 through LEG-304 enter sprint.

Legal access is intentionally not Patient auth. Legal users do not complete DOB or SMS OTP. The MVP model is bearer-link possession plus a $35 payment entitlement.

## Key Decisions

1. `/legal/[token]` is the only route that receives the raw share token.
2. After payment and session issuance, the app redirects to tokenless `/legal/viewer`.
3. `/legal/viewer/[token]` is intentionally superseded for security reasons.
4. `legalAccessPaid` is set only by a verified Stripe webhook.
5. Stripe webhook does not issue browser cookies.
6. `/legal/payment/success` only waits/polls until the database shows `legalAccessPaid=true`.
7. The legal session cookie is `__Host-onye_legal_session`, `HttpOnly`, `Secure`, `SameSite=Strict`, `Path=/`, no `Domain`, max age 8 hours.
8. Cookie value is an opaque random session ID stored hashed server-side in `legal_sessions`.
9. Existing active sessions for the same `tokenId` are invalidated before issuing a new session.
10. Token forwarding inside a legal firm is accepted MVP behavior, but access is sequential, not concurrent.
11. More than 5 distinct IP hashes for the same paid token in 24 hours creates a manual-review alert, not automatic revocation.
12. Expired or revoked tokens block viewer access even if already paid.

## Required Schema Decisions

`share_tokens` additions:

```sql
legal_access_paid boolean not null default false
legal_paid_at timestamptz null
legal_access_count integer not null default 0
```

Required/recommended tables:

1. `legal_sessions`
2. `legal_access_events`
3. `processed_stripe_events`
4. `legal_payments`
5. `legal_access_alerts`

## Audit and Telemetry

Counsel-facing legal audit logs stay minimal:

```text
tokenId
ipAddressHash
timestamp
accessEvent
```

Restricted security telemetry may include:

```text
sessionIdHash
userAgentHash
```

Use keyed HMAC-SHA256 for IP and user-agent hashes. Do not store raw IP or raw user-agent unless counsel/security explicitly approves.

## Before LEG-101

1. Reference `docs/adr/leg-001-portal-flow.md` in LEG-101 through LEG-304.
2. Confirm product accepts sequential legal-firm sharing.
3. Confirm all legal portal routes and APIs can share one hostname for the `__Host-` cookie.
4. Disable delayed Stripe payment methods unless async payment events are implemented.
5. Build tests listed in the ADR before implementing production flow.

## DoD Status

Repo-side ADR DoD is complete when this README and `docs/adr/leg-001-portal-flow.md` are present on the LEG-001 branch.

Full DoD still requires Jira tickets LEG-101 through LEG-304 to reference the ADR before sprint.
