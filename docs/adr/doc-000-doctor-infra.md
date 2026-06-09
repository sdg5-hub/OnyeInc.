# ADR DOC-000: Doctor Persona Infrastructure, Subscription, and Compliance

Status: Implemented draft  
Date: 2026-06-08  
Owner: Engineering  
Decision scope: Referring doctor persona, paid subscription access, explicit study sharing, and MVP EHR export boundaries

## Executive Summary

The MVP doctor persona is a paid referring-provider workflow. A doctor account is represented by a `doctors` row linked one-to-one with the authenticated Supabase user. Doctor access to patient imaging data must come from explicit provider share rows only; it must never be inferred from facility, specialty, patient overlap, or organization membership.

The database source of truth is:

```text
doctors
doctor_studies
```

`doctors` stores the doctor's profile, NPI, Stripe subscription identifiers, trial window, and subscription status. `doctor_studies` stores explicit study access grants for provider recipients using `recipient_type = 'PROVIDER'`.

For MVP, doctor billing is a Stripe subscription at **$49/month** with a **14-day trial**. Active or trialing doctors may access explicitly shared provider studies. `PAST_DUE` doctors receive zero patient-study rows. `CANCELED` doctors receive read-only access for 30 days from `subscription_canceled_at`, then zero patient-study rows after the grace period.

The MVP does **not** include live EHR write-back. The product-safe wording is **Export for EHR**, which generates a downloadable FHIR R4 ImagingStudy JSON Bundle. Redox, Health Gorilla, HL7 v2, SMART-on-FHIR launch, EHR onboarding, and production EHR credentials are post-MVP.

Doctor-to-doctor sharing is also post-MVP. If another specialist needs access, the patient or Imaging Tech must create a new share link or explicit provider share record.

## Decision

### 1. Doctor Model

The doctor profile is stored separately from the authenticated user:

```text
doctors.id
doctors.user_id
doctors.npi
doctors.specialty
doctors.facility_name
doctors.stripe_customer_id
doctors.stripe_subscription_id
doctors.subscription_status
doctors.trial_ends_at
doctors.subscription_canceled_at
doctors.created_at
doctors.updated_at
```

Recommended operational fields are also stored:

```text
doctors.stripe_price_id
doctors.stripe_status_raw
doctors.npi_verified_at
doctors.npi_verification_source
```

`doctors.user_id` is unique so one authenticated user maps to one doctor profile in the MVP.

### 2. NPI Uniqueness

NPI is nullable because a doctor profile may be created before NPI verification is completed. Non-null NPI values must be globally unique:

```sql
create unique index doctors_npi_unique
on public.doctors (npi)
where npi is not null;
```

Duplicate non-null NPI submissions must return:

```text
HTTP 409
This NPI is already associated with another account. If this is an error, please contact support.
```

This is enforced by the Supabase migration and by the route-level conflict handling in the spike surface.

### 3. Explicit Provider Study Access

Doctor access is based on explicit provider study share rows:

```text
doctor_studies.recipient_type = 'PROVIDER'
doctor_studies.doctor_id = doctors.id
doctor_studies.study_id = <opaque study id>
doctor_studies.revoked_at is null
```

A referring doctor may access a study only when an active, non-revoked provider share exists for that exact doctor and study. A doctor must not receive access simply because they share a facility, patient, specialty, or organization relationship.

`study_id` is intentionally opaque in this migration because the final imaging study schema may land in a separate ticket. When the committed study table exists, `doctor_studies.study_id` should be linked to the final study table with a foreign key.

### 4. Subscription Access Rules

Subscription status is represented by:

```text
TRIALING
ACTIVE
PAST_DUE
CANCELED
```

Rules:

1. `TRIALING` doctors may access explicitly shared provider studies.
2. `ACTIVE` doctors may access explicitly shared provider studies.
3. `PAST_DUE` doctors receive zero patient-study rows.
4. `CANCELED` doctors within 30 days of `subscription_canceled_at` may read explicitly shared studies only.
5. `CANCELED` doctors older than 30 days receive zero patient-study rows.

During the 30-day canceled-subscription grace period, access is read-only. A canceled doctor may view explicitly shared studies and existing patient-directory entries tied to those studies. A canceled doctor may not create new share records, invite other doctors, modify patient/study metadata, access Imaging Tech workflows, perform live EHR write-back, or use future sharing/collaboration tools.

### 5. Row-Level Security Intent

The migration enables RLS on `doctors` and `doctor_studies`. The provider-study policy only exposes rows when:

```text
recipient_type = 'PROVIDER'
revoked_at is null
doctor.user_id = auth.uid()
doctor.subscription_status in ('TRIALING', 'ACTIVE')
OR doctor is CANCELED within 30 days
```

`PAST_DUE` and expired `CANCELED` doctors are denied by the policy.

### 6. Stripe Setup

MVP doctor billing requires:

```text
STRIPE_SECRET_KEY
STRIPE_WEBHOOK_SECRET
STRIPE_DOCTOR_PRICE_ID
STRIPE_CUSTOMER_PORTAL_RETURN_URL
```

The Stripe dashboard must contain:

1. A test Product for doctor subscriptions.
2. A test recurring Price for `$49/month`.
3. A 14-day trial configuration.
4. A webhook endpoint for subscription lifecycle events.
5. Webhook signature verification using `STRIPE_WEBHOOK_SECRET`.

The application must not log Stripe secrets or place PHI in Stripe metadata.

### 7. EHR MVP Scope

MVP scope:

```text
Export for EHR generates a downloadable FHIR R4 ImagingStudy JSON Bundle.
```

Post-MVP:

1. Redox write-back.
2. Health Gorilla write-back.
3. HL7 v2 messaging.
4. Live EHR API integration.
5. SMART-on-FHIR launch.
6. EHR-specific onboarding.
7. Production EHR credentials.

Product-owner acknowledgement is required because the label "Send to EHR" can imply live transmission. The MVP-safe label is **Export for EHR**.

### 8. Doctor-to-Doctor Sharing Scope

MVP rule:

```text
A referring doctor cannot share a study directly with another doctor.
```

Doctor-to-doctor sharing is post-MVP because it adds consent, audit, disclosure tracking, authorization, and compliance complexity.

## Implementation Notes

This ADR is backed by:

1. A Supabase migration for doctor tables, subscription enums, explicit provider-share rows, partial NPI uniqueness, and RLS policies.
2. An importable doctor entitlement helper surface in `lib/doctors`.
3. API surfaces that demonstrate duplicate NPI conflict behavior and Stripe webhook signature verification.

## Definition of Done Checklist

| Requirement | Status |
| --- | --- |
| ADR committed to `/docs/adr/doc-000-doctor-infra.md` | Done |
| SQL migration added for `doctors` table | Done |
| Nullable unique NPI constraint added | Done |
| Duplicate NPI handling returns HTTP 409 | Done |
| RLS policies added or updated | Done |
| RLS verifies doctors only see explicit `recipient_type='PROVIDER'` studies | Added in migration; target Supabase verification still required |
| RLS verifies `PAST_DUE` doctors receive zero patient-study rows | Added in migration; target Supabase verification still required |
| RLS verifies expired `CANCELED` doctors receive zero rows | Added in migration; target Supabase verification still required |
| Canceled doctors within 30 days have read-only access only | Added in migration and entitlement helpers; target Supabase verification still required |
| Stripe test Product created | External Stripe dashboard setup required |
| Stripe test Price created for `$49/month` | External Stripe dashboard setup required |
| 14-day trial configured | External Stripe dashboard setup required |
| Stripe webhook endpoint configured and signature verification implemented | Signature verification implemented in `POST /api/webhooks/stripe`; Stripe dashboard endpoint registration remains |
| Stripe secrets stored using secrets-manager pattern | External secrets setup required |
| Product owner acknowledges no live EHR write-back in MVP | Product acknowledgement required |
| Product owner acknowledges doctor-to-doctor sharing is post-MVP | Product acknowledgement required |

## Open Follow-Ups

1. Link `doctor_studies.study_id` to the final imaging study table when that schema is introduced.
2. Replace spike in-memory repository calls with Supabase database calls after the service role/client pattern lands.
3. Register the deployed Stripe webhook URL in the Stripe dashboard once the account/product/price IDs exist.
4. Run integration tests against the target Supabase RLS runtime.
5. Confirm product acknowledgement for "Export for EHR" wording and doctor-to-doctor sharing scope.
