create type zip_job_status as enum (
  'PENDING',
  'PROCESSING',
  'COMPLETE',
  'FAILED'
);

create table zip_jobs (
  id uuid primary key default gen_random_uuid(),

  token_id uuid not null,
  study_id uuid not null,

  status zip_job_status not null default 'PENDING',

  source_prefix text null,
  object_key text null,
  b2_file_id text null,
  completed_object_etag text null,

  download_url text null,
  download_url_expires_at timestamptz null,
  object_expires_at timestamptz null,

  zip_size_bytes bigint null,
  study_size_bytes bigint null,
  missing_files_count integer not null default 0,

  part_size_bytes integer null,
  part_count integer null,

  retry_count integer not null default 0,
  scheduled_retry_at timestamptz null,

  failure_reason text null,
  warning_reason text null,

  worker_id text null,
  locked_at timestamptz null,
  last_heartbeat_at timestamptz null,
  alert_sent_at timestamptz null,

  deduped_from_job_id uuid null references zip_jobs(id) on delete set null,

  created_at timestamptz not null default now(),
  started_at timestamptz null,
  completed_at timestamptz null,

  constraint zip_jobs_nonnegative_sizes check (
    (zip_size_bytes is null or zip_size_bytes >= 0)
    and (study_size_bytes is null or study_size_bytes >= 0)
  ),
  constraint zip_jobs_nonnegative_counts check (
    missing_files_count >= 0
    and retry_count >= 0
    and (part_count is null or part_count >= 0)
  ),
  constraint zip_jobs_export_key_prefix check (
    object_key is null or object_key like 'legal-exports/%'
  ),
  constraint zip_jobs_complete_requires_object check (
    status <> 'COMPLETE'
    or (
      object_key is not null
      and b2_file_id is not null
      and zip_size_bytes is not null
      and download_url is not null
      and download_url_expires_at is not null
      and object_expires_at is not null
      and completed_at is not null
    )
  )
);

create index zip_jobs_pending_idx
on zip_jobs (status, scheduled_retry_at, created_at)
where status = 'PENDING';

create index zip_jobs_processing_idx
on zip_jobs (status, locked_at, last_heartbeat_at)
where status = 'PROCESSING';

create index zip_jobs_study_complete_idx
on zip_jobs (study_id, status, object_expires_at)
where status = 'COMPLETE';

create index zip_jobs_token_idx
on zip_jobs (token_id);

create index zip_jobs_deduped_from_idx
on zip_jobs (deduped_from_job_id)
where deduped_from_job_id is not null;
