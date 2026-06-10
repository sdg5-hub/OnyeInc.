# Changelog

All notable changes to this project are documented in this file.

## [Unreleased]

### Infrastructure (IC-INFRA-01)

- fix: resolve `Error: Unreadable module directory ../../modules` in
  Terraform Cloud CI runs by invoking `terraform -chdir=infra/envs/<env>`
  from the repo root instead of `working-directory: infra/envs/<env>` with
  bare `terraform` commands
- fix: split `tus_docker_image` into `image_url`/`tag` for
  `render_web_service.tus_server` — the Render provider rejects an
  `image_url` containing a tag or digest
- fix: correct Backblaze B2 CORS `allowed_operations` to valid API values
  (`b2_upload_file`, `b2_download_file_by_name`, `b2_download_file_by_id`)
- fix: remove invalid `supabase_project` data source — not supported by the
  `supabase/supabase` provider (only the resource exists)
- fix: add `default_server_side_encryption` (SSE-B2 / AES256) to the B2
  bucket module to prevent Terraform from disabling encryption-at-rest on
  apply
- chore: remove redundant `TF_VAR_*` env vars from `terraform-plan.yml` /
  `terraform-drift.yml` — values are sourced from Terraform Cloud workspace
  variables instead
- chore: add `workflow_dispatch` trigger to `terraform-plan.yml` for manual
  runs
- ci: temporarily disable `plan-production` / `drift-production` jobs
  (`if: false`) pending the production TFC org name fix and workspace
  variable verification
- docs: rewrite `provision-environment.md` for the `-chdir` invocation
  pattern and document required Terraform Cloud workspace variables
- docs: add `terraform-ci.md` runbook covering CI workflow internals and
  known issues/follow-ups
