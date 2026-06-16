# PAT-101: SMS Notification Delivery via Twilio

**Status:** Proposed / implementation-ready
**Date:** 2026-06-12
**Related tickets:** PAT-000, IC-202, IC-203, IC-OBS-01, IC-INFRA-01

## Decision

When IC-202 transitions an imaging study to `COMPLETE`, Supabase will trigger a
secure server-side request to the Render-hosted token API service. Render owns
the Twilio SDK call, phone normalization, idempotency, audit logging, structured
error logging, and dashboard warning persistence.

No Twilio call is made from the browser. Twilio credentials stay in Render
service environment secrets.

This ADR intentionally follows the S0 infrastructure decision to use Render for
the token API service, superseding older PAT-101 ticket wording that referenced
a different service host.

## Flow

1. IC-202 updates `studies.status` to `COMPLETE`.
2. A Supabase `pg_net` database trigger calls:
   `POST /internal/pat-101/send-sms`.
3. The request includes `studyId` and `X-Internal-Webhook-Secret`.
4. Render verifies the secret.
5. Render loads `facilityName`, `patientPhone`, token expiry, and the plaintext
   IC-203 share token through the `pat_101_sms_context` view/contract.
6. Render claims a `patient_sms_notifications` row for race-safe idempotency.
7. Phone is normalized to E.164 with `libphonenumber-js`.
8. SMS is sent with the official `twilio` Node.js SDK.
9. Success/failure is persisted to `patient_sms_notifications`, `audit_log`, and,
   on failure, `structured_error_log` plus dashboard warnings.

## Exact SMS Body

```text
Your imaging study from [facility name] is ready. View it securely: https://app.onyesync.com/v/[token] — This link expires in [N] days.
```

The SMS body is PHI-minimized. It must not contain patient name, DOB, diagnosis,
modality, body part, accession number, or other clinical details. The
notification is still sensitive because it reveals that an imaging study is
ready and includes a bearer link.

## Supabase Trigger

`pg_net` should trigger Render only after the study status changes to
`COMPLETE`. The trigger depends on the final IC-202 `studies` table and should be
installed when that schema lands:

```sql
create extension if not exists pg_net;

create or replace function public.notify_sms_on_study_complete()
returns trigger
language plpgsql
security definer
as $$
begin
  if new.status = 'COMPLETE'
     and old.status is distinct from new.status then
    perform net.http_post(
      url := 'https://api.onyesync.com/internal/pat-101/send-sms',
      headers := '{
        "Content-Type": "application/json",
        "X-Internal-Webhook-Secret": "<secret>"
      }'::jsonb,
      body := jsonb_build_object('studyId', new.id),
      timeout_milliseconds := 5000
    );
  end if;

  return new;
end;
$$;

create trigger trg_notify_sms_on_study_complete
after update on public.studies
for each row
execute function public.notify_sms_on_study_complete();
```

`pg_net` is a trigger only. It does not contain Twilio credentials or SMS logic.

## Data Contract

The Render service adapter reads from a `pat_101_sms_context` view/contract with:

- `study_id`
- `facility_name`
- `patient_phone`
- `share_token`
- `expires_in_days`

IC-202/IC-203 implementation should map their final `studies` and share-token
tables into this view.

## Idempotency

`patient_sms_notifications` has one automatic SMS attempt per `study_id` and
`channel='SMS'`. Duplicate triggers are suppressed by the database uniqueness
guard before Twilio is called. `audit_log` remains the compliance record for
sent/failed events.

Failed automatic attempts do not set the study to `FAILED`. A later manual retry
or resend flow must be explicit product work.

## Missing Phone And Failures

If no phone exists, Twilio is not called. The system writes:

```text
eventType='SMS_NOTIFICATION_FAILED'
failureReason='NO_PHONE_ON_FILE'
recipientPhoneHash=null
```

The Imaging Tech dashboard warning is exactly:

```text
SMS not sent — no patient phone number on file. Copy the link manually.
```

Twilio API failures and phone normalization failures are caught, written to
structured error logs under `component='PAT-101'`, surfaced as non-blocking
dashboard warnings, and leave the study status as `COMPLETE`.

## Privacy Controls

- Never log plaintext phone, plaintext token, full `/v/[token]` URL, SMS body,
  patient name, DOB, or diagnosis.
- Hash normalized E.164 phone numbers with SHA-256 before audit persistence.
- Redact `/v/*` route logs as `/v/[REDACTED]` or equivalent.
- Confirm Twilio BAA, Messaging eligibility, message redaction/privacy settings,
  and A2P 10DLC or toll-free verification before production.
- The required em dash may force UCS-2 SMS encoding and increase SMS segment
  count/cost. Keep the exact body because it is required by the ticket.

## Definition Of Done Status

Repo-side code and tests can be completed on this branch. Full PAT-101 DoD still
requires staging credentials and external verification:

- SMS received on a test device within 30 seconds.
- Duplicate COMPLETE transition sends exactly one SMS in Twilio logs.
- Invalid/missing phone creates failed audit entry and dashboard warning.
- Audit logs contain hashed phone only.
- SMS body contains no patient name, DOB, or diagnosis.
