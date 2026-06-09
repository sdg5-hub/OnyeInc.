create type public.doctor_subscription_status as enum (
  'TRIALING',
  'ACTIVE',
  'PAST_DUE',
  'CANCELED'
);

create type public.doctor_recipient_type as enum (
  'PROVIDER'
);

create table public.doctors (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null unique references auth.users(id) on delete cascade,
  npi text,
  specialty text,
  facility_name text,
  npi_verified_at timestamptz,
  npi_verification_source text,
  stripe_customer_id text unique,
  stripe_subscription_id text unique,
  stripe_price_id text,
  stripe_status_raw text,
  subscription_status public.doctor_subscription_status not null default 'TRIALING',
  trial_ends_at timestamptz,
  subscription_canceled_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index doctors_npi_unique
on public.doctors (npi)
where npi is not null;

create table public.doctor_studies (
  doctor_id uuid not null references public.doctors(id) on delete cascade,
  study_id text not null,
  recipient_type public.doctor_recipient_type not null default 'PROVIDER',
  granted_by_user_id uuid references auth.users(id) on delete set null,
  granted_at timestamptz not null default now(),
  revoked_at timestamptz,
  primary key (doctor_id, study_id)
);

create index doctor_studies_study_id_recipient_type_revoked_at_idx
on public.doctor_studies (study_id, recipient_type, revoked_at);

create index doctor_studies_doctor_id_recipient_type_revoked_at_idx
on public.doctor_studies (doctor_id, recipient_type, revoked_at);

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger set_doctors_updated_at
before update on public.doctors
for each row
execute function public.set_updated_at();

create or replace function public.doctor_has_read_access(target_doctor_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.doctors d
    where d.id = target_doctor_id
      and (
        d.subscription_status in ('TRIALING', 'ACTIVE')
        or (
          d.subscription_status = 'CANCELED'
          and d.subscription_canceled_at is not null
          and d.subscription_canceled_at >= now() - interval '30 days'
        )
      )
  );
$$;

create or replace function public.doctor_has_write_access(target_doctor_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.doctors d
    where d.id = target_doctor_id
      and d.subscription_status in ('TRIALING', 'ACTIVE')
  );
$$;

alter table public.doctors enable row level security;
alter table public.doctor_studies enable row level security;

create policy doctors_select_own_profile
on public.doctors
for select
using (user_id = auth.uid());

create policy doctors_update_own_profile
on public.doctors
for update
using (user_id = auth.uid())
with check (user_id = auth.uid());

create policy doctor_studies_select_explicit_provider_shares
on public.doctor_studies
for select
using (
  recipient_type = 'PROVIDER'
  and revoked_at is null
  and public.doctor_has_read_access(doctor_id)
  and exists (
    select 1
    from public.doctors d
    where d.id = doctor_studies.doctor_id
      and d.user_id = auth.uid()
  )
);

comment on table public.doctors is
  'DOC-000 referring doctor profile, NPI identity, and Stripe subscription state.';

comment on table public.doctor_studies is
  'DOC-000 explicit provider-study access grants. Access is never inferred from facility, patient, or specialty.';
