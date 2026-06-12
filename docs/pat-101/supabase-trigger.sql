-- PAT-101 Supabase trigger handoff.
--
-- Apply only after IC-202/IC-203 finalize the studies table and the
-- pat_101_sms_context view/contract documented in the PAT-101 ADR.
-- Replace the URL and secret placeholder with staging/prod environment values.

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
      url := 'https://<render-service-url>/api/internal/pat-101/send-sms',
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'X-Internal-Webhook-Secret', '<PAT101_INTERNAL_WEBHOOK_SECRET>'
      ),
      body := jsonb_build_object('studyId', new.id),
      timeout_milliseconds := 5000
    );
  end if;

  return new;
end;
$$;

drop trigger if exists trg_notify_sms_on_study_complete on public.studies;

create trigger trg_notify_sms_on_study_complete
after update on public.studies
for each row
execute function public.notify_sms_on_study_complete();
