# LEG-001 Legal Portal Token Route & Payment Gate ADR

**Status:** Proposed
**Owner:** Product / Engineering / Security / Compliance
**ADR Path:** `/docs/adr/leg-001-portal-flow.md`
**Related Tickets:** LEG-000, LEG-101 through LEG-304, PAT-302, IC-203
**Scope:** Legal portal token route, legal payment gate, Stripe Checkout fulfillment, `legalAccessPaid` entitlement, legal session cookie, token forwarding policy, session fixation protection, anomaly detection, re-access model, expired/revoked-after-payment behavior, and implementation requirements before LEG-101.

---

## 1. Executive Decision

LEG-001 approves the Legal persona portal flow for the Onye Radiology MVP using a **bearer-link plus payment entitlement model**.

The Legal persona receives a share link from either:

1. PAT-302 child token, or
2. IC-203 Imaging Tech-created share token.

Unlike the Patient persona, legal users do **not** complete DOB verification or SMS OTP.

The MVP Legal identity model is:

```text
legal access = possession of a 256-bit random share token + successful $35 payment
```

This is intentionally weaker than Patient authentication and must be documented as accepted product risk.

The approved LEG-001 model is:

1. Legal user enters through `/legal/[token]`.
2. System hashes token and looks up `share_tokens`.
3. System rejects expired or revoked tokens.
4. If `legalAccessPaid = false`, redirect to Stripe Checkout.
5. Stripe webhook verifies payment and sets `legalAccessPaid = true`.
6. Stripe webhook does **not** issue browser cookies.
7. Browser-facing success route or `/legal/[token]` re-checks the database and issues the legal session cookie.
8. After session issuance, user is redirected to tokenless route `/legal/viewer`.
9. Raw token is never placed in `/legal/viewer` URL.
10. Legal session cookie is opaque, HttpOnly, Secure, SameSite=Strict, and bound server-side to `tokenId`.
11. Existing legal sessions for the same `tokenId` are invalidated before issuing a new one.
12. Token forwarding within a legal firm is accepted MVP behavior, but access is sequential, not concurrent.
13. IP anomaly detection flags suspicious forwarding for manual review, not automatic revocation.
14. Expired or revoked tokens block viewer access even if already paid.
15. Paid users can re-access within token validity without paying again.

This ADR intentionally supersedes the ticket wording that says the viewer route is `/legal/viewer/[token]`.

Final route decision:

```text
/legal/[token] is the only route that receives the raw token.
After payment/session issuance, the app redirects to /legal/viewer without the raw token in the URL.
```

Reason:

The raw token is bearer material. Keeping it in the viewer URL increases leakage risk through browser history, logs, screenshots, referrers, bookmarks, analytics, and support traces.

---

## 2. Core Product/Security Trade-Off

LEG-001 uses weak legal-user identity by design.

The Legal persona does not verify:

1. DOB.
2. SMS OTP.
3. Attorney identity.
4. Firm identity.
5. Court case.
6. Bar membership.
7. NPI.
8. Government ID.
9. Persistent account login.

The Legal persona verifies only:

1. Possession of a high-entropy share token.
2. Successful payment of the $35 legal access/export fee.
3. Valid legal session cookie after payment.

ADR language:

```text
LEG-001 intentionally accepts a weak-identity legal access model. Legal recipients are not authenticated as named individuals through a persistent account, DOB check, OTP, or MFA. Access is granted to the possessor of a high-entropy share link who has paid the legal access fee. This is a bearer-link entitlement model, not verified attorney identity, and product, audit, and support language must describe it accordingly.
```

Mitigations:

1. Share token is 256-bit cryptographically random.
2. Token enumeration is infeasible.
3. Payment creates financial friction.
4. Stripe creates a payment/audit trail.
5. Every access event is logged with minimized identifiers.
6. IP anomaly detection flags suspicious use.
7. Legal session cookie is short-lived.
8. Raw token is removed from viewer URL after entry.
9. Token expiry/revocation overrides payment.

Accepted risk:

```text
A paid legal user can forward the link to another person. Anyone with the link can attempt access while the token remains valid. This is accepted MVP behavior for legal-firm workflows, with anomaly detection and manual review as guardrails.
```

---

## 3. Route Decision

### Entry route

Raw token is accepted only at:

```text
/legal/[token]
```

This route performs:

1. Token hash.
2. Token lookup.
3. Expiry check.
4. Revocation check.
5. Payment entitlement check.
6. Checkout redirect if unpaid.
7. Session issuance if already paid and valid.

### Payment success route

Stripe redirects user to:

```text
/legal/payment/success
```

This route does not trust the redirect alone.

It must:

1. Read an opaque checkout/access reference, never the raw share token.
2. Re-check token validity.
3. Re-check `legalAccessPaid = true`.
4. If webhook has completed, issue session cookie.
5. If webhook has not completed, show "finalizing access" state and retry/poll.
6. Redirect to `/legal/viewer`.

### Viewer route

After session issuance, viewer route is:

```text
/legal/viewer
```

The viewer route does not include the raw token.

Authorization is derived from:

1. `__Host-onye_legal_session` cookie.
2. `legal_sessions` row.
3. Session-bound `tokenId`.
4. Valid, unexpired, non-revoked share token.
5. `legalAccessPaid = true`.

### Ticket wording supersession

The ticket acceptance criteria says:

```text
/legal/viewer/[token]
```

LEG-001 intentionally changes this to:

```text
/legal/viewer
```

Reason:

```text
The raw share token is bearer material and must not remain in post-auth viewer URLs.
```

This is a security-driven change from the ticket wording, not an omission.

---

## 4. Full Legal Portal Flow

### 4.1 GET `/legal/[token]`

Flow:

```text
GET /legal/[token]
  -> normalize token input
  -> hash token
  -> lookup share_tokens by tokenHash
  -> reject if token does not exist
  -> reject if token is expired
  -> reject if token is revoked
  -> if legalAccessPaid = false:
       create or reuse Stripe Checkout Session
       redirect to Stripe Checkout
  -> if legalAccessPaid = true:
       invalidate prior legal_sessions for tokenId
       issue new legal session cookie
       redirect to /legal/viewer
```

Important:

1. Never log raw token.
2. Never store raw token.
3. Never put raw token in Stripe metadata.
4. Never include raw token in redirect URLs after entry.

### 4.2 Stripe Checkout

Checkout mode:

```text
mode = payment
```

Product:

```text
Onye Legal Export Access
```

Amount:

```text
$35
```

Stripe metadata must not include PHI.

Allowed metadata:

```text
legalAccessId = opaque UUID
```

Do not include:

```text
patient name
DOB
MRN
accession number
StudyInstanceUID
modality
diagnosis
law firm
attorney name
case reference
claim number
raw share token
tokenId if not opaque
```

### 4.3 Stripe webhook

Webhook route:

```text
POST /api/webhooks/stripe-legal
```

Flow:

```text
POST /api/webhooks/stripe-legal
  -> read raw request body
  -> verify Stripe-Signature
  -> reject invalid signature with HTTP 400
  -> dedupe by Stripe event ID
  -> if checkout.session.completed:
       confirm payment_status = paid
       lookup legal payment/access row
       set share_tokens.legalAccessPaid = true
       set share_tokens.legalPaidAt = now()
       store Stripe Checkout Session ID
       store PaymentIntent ID
       store receipt URL when available
       write LEGAL_PAYMENT_SUCCEEDED event
  -> return 2xx quickly
```

Webhook rule:

```text
Stripe webhook is the payment authority for setting legalAccessPaid=true.
Stripe webhook never issues browser cookies.
```

Reason:

The webhook is server-to-server from Stripe to Onye. It cannot set a browser cookie for the user because the user's browser is not the webhook caller.

### 4.4 GET `/legal/payment/success`

Flow:

```text
GET /legal/payment/success
  -> read opaque checkout/access reference
  -> re-check share token validity
  -> re-check legalAccessPaid = true
  -> if paid and valid:
       invalidate prior legal_sessions for tokenId
       issue new session cookie
       redirect /legal/viewer
  -> if webhook not completed yet:
       show finalizing access page
       poll/retry until legalAccessPaid=true or timeout
  -> if expired/revoked:
       show expired/revoked paid page if payment exists
```

Success-route rule:

```text
For MVP, the success route must never set legalAccessPaid=true. It may only wait/poll until the verified Stripe webhook updates the database. Any future Stripe API fallback must be separately reviewed and documented.
```

If webhook has not completed yet:

```text
Show "Finalizing access..." and poll/retry until DB confirms legalAccessPaid=true.
```

### 4.5 GET `/legal/viewer`

Flow:

```text
GET /legal/viewer
  -> read __Host-onye_legal_session cookie
  -> hash session ID
  -> lookup legal_sessions
  -> reject if session missing
  -> reject if session expired
  -> reject if session revoked
  -> lookup tokenId from legal_sessions
  -> reject if share token expired/revoked
  -> reject if legalAccessPaid=false
  -> renew sliding session if allowed
  -> render legal viewer
```

Viewer route must not accept raw token.

---

## 5. Payment Race Decision

Stripe may redirect the browser to the success route before webhook processing has completed locally.

Decision:

```text
/legal/payment/success must not grant access from redirect parameters alone.
```

For MVP, the success route must never set:

```text
legalAccessPaid = true
```

Only the verified Stripe webhook may set `legalAccessPaid=true`.

If `legalAccessPaid` is not true yet, the success route should show:

```text
Finalizing access...
```

Then it should:

1. Poll the backend for a short period, or
2. Retry database check, or
3. Ask user to refresh after a short wait.

It must not:

1. Set `legalAccessPaid=true` from redirect parameters.
2. Set `legalAccessPaid=true` by trusting the success URL.
3. Issue a session cookie from unverified redirect parameters.
4. Show the viewer before database entitlement exists.

Future exception:

```text
Any future Stripe API fallback that allows the success route to verify payment directly must be separately reviewed and documented in a later ADR or ADR amendment.
```

This prevents forged success redirects from granting access.

---

## 6. `legalAccessPaid` Entitlement

Add columns to `share_tokens`:

```sql
alter table share_tokens
  add column legal_access_paid boolean not null default false,
  add column legal_paid_at timestamptz null,
  add column legal_access_count integer not null default 0;
```

ADR field names:

```text
legalAccessPaid
legalPaidAt
legalAccessCount
```

Rules:

1. `legalAccessPaid` defaults to `false`.
2. `legalAccessPaid` is set to `true` only by verified Stripe webhook fulfillment.
3. `legalPaidAt` is set when webhook confirms paid Checkout.
4. `legalAccessCount` increments on distinct legal session issuance.
5. Payment does not override token expiry.
6. Payment does not override token revocation.
7. Payment allows re-access only while token remains valid.

Important:

```text
legalAccessPaid is an entitlement snapshot, not a complete payment ledger.
```

A separate `legal_payments` table is recommended.

---

## 7. Recommended Payment Schema

### `legal_payments`

Recommended table:

```sql
create table legal_payments (
  id uuid primary key default gen_random_uuid(),
  token_id uuid not null references share_tokens(id) on delete cascade,
  stripe_checkout_session_id text null unique,
  stripe_payment_intent_id text null unique,
  stripe_charge_id text null,
  stripe_receipt_url text null,
  amount_cents integer not null default 3500,
  currency text not null default 'usd',
  payment_status text not null default 'PENDING',
  paid_at timestamptz null,
  refunded_at timestamptz null,
  disputed_at timestamptz null,
  revoked_at timestamptz null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
```

Recommended statuses:

```text
PENDING
PAID
FAILED
REFUNDED
DISPUTED
REVOKED
```

Reason:

`legalAccessPaid` alone is too thin for:

1. refund handling,
2. chargebacks,
3. expired-but-paid pages,
4. receipt lookup,
5. payment reconciliation,
6. duplicate webhook handling,
7. support disputes.

---

## 8. Stripe Webhook Idempotency

Webhook events may be retried or delivered more than once.

Add table:

```sql
create table processed_stripe_events (
  stripe_event_id text primary key,
  event_type text not null,
  processed_at timestamptz not null default now()
);
```

Webhook behavior:

1. Verify signature first.
2. Check `processed_stripe_events`.
3. If already processed, return 2xx.
4. If new, process event transactionally.
5. Insert event ID.
6. Return 2xx quickly.

Must handle:

```text
checkout.session.completed
```

Optional future events if delayed payment methods are enabled:

```text
checkout.session.async_payment_succeeded
checkout.session.async_payment_failed
```

Recommended MVP restriction:

```text
Use immediate payment methods only for LEG-001 MVP unless delayed payment handling is implemented.
```

---

## 9. Legal Session Cookie Decision

Cookie name:

```text
__Host-onye_legal_session
```

Cookie attributes:

```text
HttpOnly: true
Secure: true
SameSite: Strict
Path: /
Max-Age: 8 hours
Domain: omitted
```

Cookie value:

```text
opaque random session ID
```

Never use:

```text
raw tokenId
raw share token
Stripe session ID
patient identifier
study identifier
```

Preferred model:

```text
opaque random session ID stored hashed server-side in legal_sessions
```

Alternative:

```text
signed JWT
```

Decision:

```text
Prefer opaque random session ID, stored hashed server-side.
```

Reason:

Opaque server-side sessions support:

1. immediate revocation,
2. one-active-session-per-token,
3. anomaly detection,
4. manual review holds,
5. idle expiration,
6. absolute expiration,
7. token-bound authorization,
8. no PHI/session state in cookie.

---

## 10. `legal_sessions` Table

Recommended table:

```sql
create table legal_sessions (
  id uuid primary key default gen_random_uuid(),
  session_id_hash text not null unique,
  token_id uuid not null references share_tokens(id) on delete cascade,
  issued_at timestamptz not null default now(),
  last_seen_at timestamptz not null default now(),
  idle_expires_at timestamptz not null,
  absolute_expires_at timestamptz not null,
  issued_ip_hash text null,
  issued_user_agent_hash text null,
  revoked_at timestamptz null,
  revocation_reason text null
);
```

Session secret generation:

```text
Generate 256-bit random session secret.
Store only HMAC/hash of session secret server-side.
Set raw session secret only in HttpOnly cookie.
```

Session expiration:

```text
Absolute max age: 8 hours
Sliding renewal: yes
Idle timeout: recommended 30-60 minutes, product/security configurable
```

Important:

Sliding renewal must not extend beyond the absolute 8-hour cap.

---

## 11. Session Fixation Handling

Ticket requirement:

```text
Any pre-existing session for the same tokenId is invalidated before the new one is issued.
```

ADR decision:

```text
Before issuing a new legal session for a paid token, revoke all existing active legal_sessions for the same tokenId.
```

Example:

```sql
update legal_sessions
set revoked_at = now(),
    revocation_reason = 'REPLACED_BY_NEW_SESSION'
where token_id = :token_id
  and revoked_at is null;
```

Then issue the new session.

Security benefit:

1. Prevents stale session reuse.
2. Prevents session fixation.
3. Ensures a new session is minted only after token validity and payment entitlement are confirmed.
4. Enables clear session lifecycle audit.

Product implication:

```text
Only one active legal session exists per token at a time.
```

This means legal-firm forwarding is sequential, not concurrent.

---

## 12. Token Forwarding Decision

Token forwarding within a legal firm is accepted MVP behavior.

Decision:

```text
Accept forwarding as intended legal-firm behavior, with IP anomaly detection and manual review. Do not auto-revoke because that may block legitimate legal teams.
```

Important nuance:

Because LEG-001 invalidates prior legal sessions before issuing a new session for the same `tokenId`, forwarding is accepted only as **sequential access**, not simultaneous multi-user access.

ADR wording:

```text
Token forwarding within a legal firm is accepted product behavior for MVP. A paid legal recipient may forward the share link internally, and another possessor may establish a new legal session while the token remains valid. However, because LEG-001 enforces one active legal session per token, each new session invalidates any prior active session for that token. This supports sequential firm handoff, not simultaneous firm-wide access.
```

Do not auto-revoke solely for forwarding.

Instead:

1. Track distinct IP HMACs.
2. Track restricted user-agent HMAC telemetry.
3. Alert if more than 5 distinct IPs access same paid token within 24 hours.
4. Flag for manual engineering/compliance review.
5. Keep viewer available unless manually revoked.

---

## 13. Audit Log vs Security Telemetry Split

LEG-000 requires minimized legal audit logs.

Minimal legal audit log contains only:

```text
tokenId
ipAddressHash
timestamp
accessEvent
```

LEG-001 also needs `userAgentHash` for anomaly detection.

Decision:

```text
Minimal legal audit logs contain tokenId, ipAddressHash, timestamp, and accessEvent. userAgentHash is stored only in restricted security telemetry for anomaly detection, not in the counsel-facing legal audit log.
```

Do not log in legal audit logs unless counsel approves:

```text
firm name
attorney name
case reference
claim number
matter number
insurance company
adjuster name
patient litigation notes
legal strategy
```

Security telemetry may store:

```text
tokenId
sessionIdHash
ipAddressHash
userAgentHash
timestamp
accessEvent
```

Access to security telemetry should be restricted to security/engineering/compliance roles.

---

## 14. HMAC Hashing Decision

Use keyed HMAC-SHA256 for IP and user-agent hashes.

Do not use plain SHA-256.

Reason:

IPv4 addresses and user-agent strings have limited entropy. Plain hashes can be brute-forced. HMAC requires a server-held secret key, making offline guessing harder if logs are exposed.

Recommended fields:

```text
ipAddressHash = HMAC-SHA256(LEGAL_TELEMETRY_HMAC_KEY, normalizedIp)
userAgentHash = HMAC-SHA256(LEGAL_TELEMETRY_HMAC_KEY, normalizedUserAgent)
```

Do not store raw IP or raw user-agent unless counsel/security explicitly approves.

---

## 15. `legal_access_events` Table

Recommended restricted security telemetry table:

```sql
create type legal_access_event_type as enum (
  'LEGAL_TOKEN_OPENED',
  'LEGAL_PAYMENT_STARTED',
  'LEGAL_PAYMENT_SUCCEEDED',
  'LEGAL_PAYMENT_FINALIZING',
  'LEGAL_SESSION_ISSUED',
  'LEGAL_VIEWER_OPENED',
  'LEGAL_SESSION_RENEWED',
  'LEGAL_SESSION_REVOKED',
  'LEGAL_TOKEN_EXPIRED_PAID',
  'LEGAL_TOKEN_REVOKED_PAID',
  'LEGAL_ANOMALY_DETECTED'
);

create table legal_access_events (
  id uuid primary key default gen_random_uuid(),
  token_id uuid not null references share_tokens(id) on delete cascade,
  session_id_hash text null,
  ip_address_hash text not null,
  user_agent_hash text null,
  access_event legal_access_event_type not null,
  created_at timestamptz not null default now()
);
```

Counsel-facing audit export should include only:

```text
tokenId
ipAddressHash
timestamp
accessEvent
```

Security telemetry table may include `userAgentHash`.

---

## 16. IP Anomaly Detection

Rule:

```text
Alert if the same paid token is accessed from more than 5 distinct IP addresses within 24 hours.
```

Detection query concept:

```sql
select count(distinct ip_address_hash)
from legal_access_events
where token_id = :token_id
  and created_at > now() - interval '24 hours'
  and access_event in (
    'LEGAL_SESSION_ISSUED',
    'LEGAL_VIEWER_OPENED',
    'LEGAL_SESSION_RENEWED'
  );
```

If count > 5:

1. Create alert.
2. Flag token for manual review.
3. Notify engineering/compliance.
4. Do not auto-revoke in MVP.

---

## 17. `legal_access_alerts` Table

Recommended table:

```sql
create type legal_access_alert_status as enum (
  'OPEN',
  'ACKNOWLEDGED',
  'RESOLVED',
  'DISMISSED'
);

create table legal_access_alerts (
  id uuid primary key default gen_random_uuid(),
  token_id uuid not null references share_tokens(id) on delete cascade,
  alert_type text not null,
  threshold_value integer null,
  observed_value integer null,
  window_start timestamptz null,
  window_end timestamptz null,
  status legal_access_alert_status not null default 'OPEN',
  created_at timestamptz not null default now(),
  acknowledged_at timestamptz null,
  resolved_at timestamptz null,
  resolution_notes text null
);
```

Recommended alert type:

```text
LEGAL_TOKEN_MULTI_IP_ANOMALY
```

---

## 18. Expired or Revoked After Payment

Payment does not override expiry or revocation.

If:

```text
legalAccessPaid = true
AND token expired
```

then:

1. Do not issue session.
2. Do not show viewer.
3. Show expired-but-paid page.
4. Include Stripe-hosted receipt link if available.
5. Provide support/refund instructions if product approves.

If:

```text
legalAccessPaid = true
AND token revoked
```

then:

1. Do not issue session.
2. Do not show viewer.
3. Show revoked-but-paid page.
4. Include Stripe-hosted receipt link if available.
5. Provide support/refund instructions if product approves.

Required page:

```text
/legal/payment/expired
```

or equivalent LEG-101 page.

Recommended message:

```text
This legal access link is no longer active. Your payment record is still available through your Stripe receipt. Contact support if you believe this is an error.
```

---

## 19. Re-Access Model

A legal user who has paid and whose token is still valid may re-access the viewer without paying again.

Re-access flow:

```text
GET /legal/[token]
  -> token valid
  -> legalAccessPaid=true
  -> invalidate prior legal_sessions for tokenId
  -> issue new session cookie
  -> redirect /legal/viewer
```

If user has no cookie but token is valid and paid:

```text
issue new session after DB confirmation
```

If user has expired session but token is valid and paid:

```text
issue new session after DB confirmation
```

If token is expired/revoked:

```text
do not issue new session even if paid
```

---

## 20. Cache and Referrer Controls

Sensitive legal routes must use strict headers.

Recommended headers:

```text
Cache-Control: no-store
Referrer-Policy: no-referrer
X-Content-Type-Options: nosniff
```

Routes requiring these headers:

```text
/legal/[token]
/legal/payment/success
/legal/viewer
/legal/payment/expired
```

Reason:

1. Raw token must not be cached.
2. Session-bearing responses must not be cached.
3. Referrer headers must not leak token URLs.
4. Browser history/log leakage should be minimized.

Viewer pages should avoid third-party scripts/assets unless security approves.

---

## 21. `__Host-` Cookie Deployment Constraint

`__Host-` cookies are host-only.

Decision:

```text
The legal entry route, success route, viewer route, and protected viewer APIs should live on the same hostname if using __Host-onye_legal_session.
```

Reason:

The cookie omits `Domain`, uses `Path=/`, and is scoped to the exact host.

If Onye deploys viewer APIs on a different hostname, the cookie will not be sent there.

Open implementation question:

```text
Will /legal/[token], /legal/payment/success, /legal/viewer, and protected legal API routes all run on the same host?
```

If not, the cookie strategy must be revisited.

---

## 22. Minimal Schema Summary

Required `share_tokens` additions:

```sql
alter table share_tokens
  add column legal_access_paid boolean not null default false,
  add column legal_paid_at timestamptz null,
  add column legal_access_count integer not null default 0;
```

Required/recommended new tables:

```text
legal_payments
legal_sessions
legal_access_events
processed_stripe_events
legal_access_alerts
```

Minimum required for LEG-101:

1. `share_tokens.legal_access_paid`
2. `share_tokens.legal_paid_at`
3. `share_tokens.legal_access_count`
4. `legal_sessions`
5. `processed_stripe_events`
6. `legal_access_events`

Strongly recommended:

1. `legal_payments`
2. `legal_access_alerts`

---

## 23. Implementation Notes

### Token handling

1. Token must be 256-bit random.
2. Store token hash, not raw token.
3. Never log raw token.
4. Never pass raw token to Stripe.
5. Use raw token only at `/legal/[token]`.
6. Redirect to tokenless viewer after session issuance.

### Checkout handling

1. Create Checkout Session only after token validity check.
2. Use server-side fixed amount.
3. Do not accept price from frontend.
4. Reuse open Checkout Session if practical.
5. Store Stripe Checkout Session ID.
6. Store PaymentIntent ID when available.

### Webhook handling

1. Verify raw body and signature.
2. Use webhook signing secret.
3. Confirm `payment_status = paid`.
4. Dedupe event IDs.
5. Set `legalAccessPaid=true`.
6. Return 2xx quickly.
7. Do not issue cookie.

### Success route handling

1. Do not trust redirect alone.
2. Never set `legalAccessPaid=true` in MVP.
3. Re-check DB state.
4. If webhook pending, show finalizing state.
5. Issue cookie only after DB confirms token is valid and paid.

### Session handling

1. Use opaque random session ID.
2. Store hashed session ID.
3. Invalidate prior session for same token.
4. Set `__Host-onye_legal_session`.
5. Enforce idle and absolute expiry server-side.
6. Renew sliding session on viewer access only within absolute cap.

---

## 24. Tests Required Before LEG-101

Required tests:

1. Valid unpaid token redirects to Stripe Checkout.
2. Invalid token returns error and does not create Checkout Session.
3. Expired token does not create Checkout Session.
4. Revoked token does not create Checkout Session.
5. Stripe webhook rejects invalid signature.
6. Stripe webhook requires raw body verification.
7. Stripe webhook sets `legalAccessPaid=true` only when `payment_status=paid`.
8. Success route never sets `legalAccessPaid=true` in MVP.
9. Duplicate Stripe webhook event is ignored idempotently.
10. Success route does not issue cookie before webhook updates DB.
11. Success route shows "finalizing access" while webhook is pending.
12. Paid valid token with no cookie gets new session.
13. Paid expired token gets expired-but-paid page.
14. Paid revoked token gets revoked/expired page.
15. New session invalidates prior `legal_sessions` for same `tokenId`.
16. Old cookie cannot access viewer after replacement session is issued.
17. Cookie has `HttpOnly`.
18. Cookie has `Secure`.
19. Cookie has `SameSite=Strict`.
20. Cookie has `Path=/`.
21. Cookie has `__Host-` prefix and no `Domain`.
22. Cookie does not contain raw token or tokenId.
23. Viewer route `/legal/viewer` works with valid session cookie.
24. Viewer route does not accept raw token in URL.
25. `/legal/viewer/[token]` is not required and should not be used.
26. `Cache-Control: no-store` is present on sensitive routes.
27. `Referrer-Policy: no-referrer` is present on sensitive routes.
28. `legalAccessCount` increments on distinct session issuance.
29. Access events use HMAC-SHA256 IP hash.
30. `userAgentHash` is stored only in restricted security telemetry.
31. More than 5 distinct IP hashes in 24 hours creates manual-review alert.
32. Multi-IP anomaly does not auto-revoke token.
33. Re-access within validity window does not require another payment.

---

## 25. Definition of Done

LEG-001 ADR is complete when:

1. ADR is committed to:

```text
/docs/adr/leg-001-portal-flow.md
```

2. Weak identity model is explicitly documented.
3. Link possession + payment risk is explicitly accepted.
4. Token is documented as 256-bit cryptographically random.
5. `/legal/[token]` routing is documented.
6. Tokenless `/legal/viewer` route decision is documented.
7. Ticket route `/legal/viewer/[token]` is explicitly superseded.
8. Stripe Checkout payment gate is documented.
9. Webhook-only entitlement update is documented.
10. Webhook cannot issue browser cookie is documented.
11. Success route DB re-check is documented.
12. Success route never setting `legalAccessPaid=true` in MVP is documented.
13. Payment race/finalizing access behavior is documented.
14. Legal session cookie settings are documented.
15. Opaque server-side session ID is documented.
16. Session fixation behavior is documented.
17. One-active-session-per-token behavior is documented.
18. Sequential forwarding decision is documented.
19. Expired/revoked-after-payment behavior is documented.
20. Re-access model is documented.
21. Audit vs security telemetry split is documented.
22. HMAC-SHA256 for IP/user-agent hashes is documented.
23. Schema changes are documented.
24. Tests required before LEG-101 are documented.
25. LEG-101 through LEG-304 are updated to reference this ADR before sprint.

---

## 26. Open Questions

1. Does product accept sequential legal-firm sharing, or do they want limited concurrent sessions?
2. Should the IP threshold remain 5 distinct IPs in 24 hours, or should it be configurable?
3. Should `userAgentHash` retention be shorter than ordinary audit retention?
4. Does counsel approve storing `userAgentHash` in restricted security telemetry?
5. Should chargebacks automatically revoke `legalAccessPaid`, or only block future exports?
6. Should refunds revoke viewer re-access immediately?
7. Should expired-but-paid users be offered automatic refund instructions?
8. Should delayed Stripe payment methods be disabled for MVP?
9. Can all legal portal routes and APIs run on one hostname for `__Host-` cookie compatibility?
10. Should legal session absolute timeout be exactly 8 hours, or shorter for PHI sensitivity?
11. Should the viewer require re-entry through `/legal/[token]` after absolute session expiry?
12. Should a user be able to manually end a legal session?
13. Should any future Stripe API payment-verification fallback be allowed, or should webhook-only fulfillment remain permanent?

---

## 27. Final Recommendation

LEG-001 should proceed with the following final decisions:

1. Accept weak legal identity model as product risk.
2. Treat legal access as bearer-link plus payment entitlement, not attorney authentication.
3. Use `/legal/[token]` only as raw-token entry route.
4. Replace `/legal/viewer/[token]` with tokenless `/legal/viewer`.
5. Use Stripe Checkout for $35 payment.
6. Set `legalAccessPaid=true` only from verified Stripe webhook.
7. Do not issue browser cookie from webhook.
8. For MVP, do not allow the success route to set `legalAccessPaid=true`.
9. Use `/legal/payment/success` or `/legal/[token]` to issue cookie after DB confirms payment.
10. Show finalizing access page if webhook is not complete.
11. Use `__Host-onye_legal_session` cookie.
12. Prefer opaque random session ID stored hashed in `legal_sessions`.
13. Never store raw token in cookie.
14. Never put raw token in post-auth viewer URL.
15. Invalidate prior sessions for the same `tokenId` before issuing a new session.
16. Accept token forwarding as intended legal-firm behavior, but sequential only.
17. Use manual-review anomaly detection, not auto-revocation.
18. Use HMAC-SHA256 for IP/user-agent hashes.
19. Keep counsel-facing audit logs minimal.
20. Store `userAgentHash` only in restricted security telemetry.
21. Require LEG-001 tests before LEG-101 implementation.

---

## 28. Source Appendix

Official/security sources reviewed:

| Area     | Source                                                                                                                                              |
| -------- | --------------------------------------------------------------------------------------------------------------------------------------------------- |
| OWASP    | Session Management Cheat Sheet: https://cheatsheetseries.owasp.org/cheatsheets/Session_Management_Cheat_Sheet.html                                  |
| NIST     | SP 800-63B Authentication and Session Guidance: https://pages.nist.gov/800-63-4/sp800-63b.html                                                      |
| NIST     | FIPS 198-1 HMAC Standard: https://nvlpubs.nist.gov/nistpubs/FIPS/NIST.FIPS.198-1.pdf                                                                |
| MDN      | Set-Cookie Header: https://developer.mozilla.org/en-US/docs/Web/HTTP/Reference/Headers/Set-Cookie                                                   |
| MDN      | Referrer-Policy Header: https://developer.mozilla.org/en-US/docs/Web/HTTP/Headers/Referrer-Policy                                                   |
| MDN      | Referer Header Privacy and Security Concerns: https://developer.mozilla.org/en-US/docs/Web/Security/Referer_header%3A_privacy_and_security_concerns |
| MDN      | Cache-Control Header: https://developer.mozilla.org/en-US/docs/Web/HTTP/Reference/Headers/Cache-Control                                             |
| Next.js  | Cookies API: https://nextjs.org/docs/app/api-reference/functions/cookies                                                                            |
| Stripe   | Webhooks Overview: https://docs.stripe.com/webhooks                                                                                                 |
| Stripe   | Checkout Session Object: https://docs.stripe.com/api/checkout/sessions/object                                                                       |
| Stripe   | Create Checkout Session: https://docs.stripe.com/api/checkout/sessions/create                                                                       |
| Stripe   | Checkout Event Types: https://docs.stripe.com/api/events/types                                                                                      |
| Stripe   | Stripe Metadata Guidance: https://docs.stripe.com/metadata                                                                                          |
| Stripe   | Charge Object / Receipt URL: https://docs.stripe.com/api/charges/object                                                                             |
| Onye ADR | LEG-000 Legal Infrastructure & Compliance ADR: `/docs/adr/leg-000-legal-infra.md`                                                                   |
