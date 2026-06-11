# LEG-001 Branch Handoff

This branch adds the Legal Portal Token Route and Payment Gate ADR and README handoff for LEG-001.

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

Jira tickets LEG-101 through LEG-304 should reference `docs/adr/leg-001-portal-flow.md` before sprint.
