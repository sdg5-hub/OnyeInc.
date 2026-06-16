# Runbook: PAT-101 Staging SMS Validation

Use this runbook to close the external PAT-101 DoD after PR review/merge and
staging deployment.

## Prerequisites

- PAT-101 code deployed to the Render-hosted token API service.
- Render service environment secrets set:
  - `PAT101_INTERNAL_WEBHOOK_SECRET`
  - `PAT101_APP_BASE_URL=https://app.onyesync.com`
  - `SUPABASE_URL`
  - `SUPABASE_SERVICE_ROLE_KEY`
  - `TWILIO_ACCOUNT_SID`
  - `TWILIO_AUTH_TOKEN`
  - `TWILIO_MESSAGING_SERVICE_SID` or `TWILIO_FROM_NUMBER`
- Twilio staging sender configured.
- Twilio BAA/message-redaction/privacy settings and A2P 10DLC or toll-free
  status confirmed before production traffic.
- IC-202/IC-203 schema exposes a `pat_101_sms_context` view/contract with:
  `study_id`, `facility_name`, `patient_phone`, `share_token`,
  `expires_in_days`.
- Supabase `pg_net` trigger from `/docs/pat-101/supabase-trigger.sql` installed
  against the staging `studies` table.
- A real test device phone number is attached to a staging study.

## Smoke The Internal Endpoint

This verifies endpoint auth/routing before using a real status transition.

```bash
PAT101_SMOKE_BASE_URL="https://<render-staging-url>" \
PAT101_INTERNAL_WEBHOOK_SECRET="<staging-secret>" \
PAT101_SMOKE_STUDY_ID="<study-uuid>" \
npm run pat101:smoke
```

Expected result: JSON response with `status` equal to `sent`, `failed`, or
`suppressed`. Any `401`, `400`, or `500` must be fixed before DoD testing.

## DoD Test Matrix

| Test | Action | Evidence |
|---|---|---|
| Successful delivery | Move a staging study with a valid phone from non-COMPLETE to `COMPLETE`. | SMS received on test phone within 30 seconds; Twilio dashboard shows one message. |
| Idempotency | Re-trigger the same `COMPLETE` transition or replay the webhook. | Twilio dashboard still shows exactly one message for the study. |
| Missing phone | Use a staging study with no patient phone and set status to `COMPLETE`. | No Twilio message; audit event has `SMS_NOTIFICATION_FAILED`, `NO_PHONE_ON_FILE`, and `recipientPhoneHash=null`; dashboard warning appears. |
| Invalid phone | Use an invalid phone and set status to `COMPLETE`. | No Twilio message; structured error log contains `INVALID_PATIENT_PHONE`; study remains `COMPLETE`. |
| Audit privacy | Inspect audit/error records for the test study. | Phone is SHA-256 hash only; no plaintext phone, token, SMS body, patient name, DOB, or diagnosis. |
| SMS body privacy | Inspect the received SMS. | Body matches the PAT-101 template exactly and contains no patient name, DOB, diagnosis, modality, body part, or accession number. |
| Token route logging | Open `/v/[token]` once. | Server logs show `/v/[REDACTED]` or equivalent, not the plaintext token. |

## Useful Queries

```sql
select event_type,
       study_id,
       recipient_phone_hash,
       twilio_message_sid,
       failure_reason,
       timestamp
from audit_log
where study_id = '<study-uuid>'
order by timestamp desc;
```

```sql
select status,
       recipient_phone_hash,
       twilio_message_sid,
       failure_reason,
       dashboard_warning,
       sent_at,
       updated_at
from patient_sms_notifications
where study_id = '<study-uuid>';
```

```sql
select component,
       error_code,
       error_type,
       safe_message,
       timestamp
from structured_error_log
where component = 'PAT-101'
  and study_id = '<study-uuid>'
order by timestamp desc;
```

## Completion Note

PAT-101 full DoD is complete only after the PR is reviewed/merged and the
evidence above is captured from staging.
