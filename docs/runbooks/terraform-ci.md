# Runbook: Terraform CI Workflows

Two GitHub Actions workflows automate Terraform for `infra/`:

- **`.github/workflows/terraform-plan.yml`** — runs `terraform plan` on every
  PR that touches `infra/**`, and posts the plan output as a PR comment for
  staging and production.
- **`.github/workflows/terraform-drift.yml`** — runs nightly (cron) plus
  `workflow_dispatch`, and opens a GitHub issue if `terraform plan` detects
  drift (`-detailed-exitcode` returns `2`).

Both workflows have one job per environment: `*-staging` and `*-production`.

## Why `-chdir=infra/envs/<env>` instead of `working-directory`

Every `terraform` invocation in both workflows is prefixed with
`-chdir=infra/envs/<env>` and run with the default checkout CWD (repo root) —
**not** `defaults.run.working-directory: infra/envs/<env>` with bare
`terraform` commands.

The two are not equivalent for Terraform Cloud's CLI-driven runs. Setting
`working-directory: infra/envs/staging` makes `terraform init`/`plan` run with
CWD = `infra/envs/staging`, which is the same pattern that produces:

```
Error: Unreadable module directory
... lstat ../../modules: no such file or directory
```

because TFC's upload boundary excludes `infra/modules/`. Running
`terraform -chdir=infra/envs/staging <command>` from the repo root uploads the
whole repo as the configuration directory, correctly resolving
`../../modules/*`. This was confirmed via a real `plan-staging` run (see
[provision-environment.md](./provision-environment.md) for the equivalent
local invocation).

If you add a new job or step to either workflow, follow the same pattern:
**no `defaults.run.working-directory`, every `terraform` call gets
`-chdir=infra/envs/<env>`.**

## Production jobs are temporarily disabled

`plan-production` (in `terraform-plan.yml`) and `drift-production` (in
`terraform-drift.yml`) currently have:

```yaml
if: false  # TODO: re-enable once production org/workspace config is verified
```

This is because:

1. `infra/envs/production/main.tf` still has `organization = "onye"` instead
   of the real TFC org `onye-dev` (staging was already corrected).
2. It's unverified whether the `onye-radiology-production` TFC workspace has
   all 8 required variables set (see
   [Secrets reference](./provision-environment.md#secrets-reference)) —
   `onye-radiology-staging` was initially missing `render_api_key`,
   `render_owner_id`, and `tus_docker_image`, which surfaced as
   `No value for required variable` errors only after CI ran.

**To re-enable**: fix the org name, confirm the production workspace
variables (including the `b2_allowed_origins` HCL toggle), then delete the
`if: false` line (and its comment) from both jobs.

## Manually triggering workflows

- **`terraform-plan.yml`** has `workflow_dispatch:` — runnable from the
  Actions tab ("Run workflow") or `gh workflow run terraform-plan.yml --ref <branch>`.
- **`terraform-drift.yml`** has `workflow_dispatch:` and `schedule:`, but
  **neither works until this workflow file exists on the default branch
  (`main`)**. GitHub only registers a workflow (making it appear in the
  Actions UI / `gh workflow run`) once it has run at least once or exists on
  the default branch. Until then, `gh workflow run terraform-drift.yml`
  returns `404 Not Found`. This resolves automatically after merging to
  `main` — no workflow change needed.

## Known issues / Follow-ups

- **B2 bucket/key have no `prevent_destroy`** — `infra/modules/b2/main.tf`
  (`b2_bucket.main`, `b2_application_key.main`) lacks
  `lifecycle { prevent_destroy = true }`. An accidental `terraform destroy` or
  a change that forces replacement would delete the bucket. Deferred —
  add when the module's resource arguments have stabilized.
- **`cloud {}` block duplication** — `infra/envs/{staging,production}/main.tf`
  hardcode `organization`/`workspaces.name`, which is most of why
  `terraform-plan.yml`/`terraform-drift.yml` duplicate each job per
  environment. Refactoring to `TF_CLOUD_ORGANIZATION`/`TF_WORKSPACE` env vars
  would allow a matrix strategy to de-duplicate the workflows. Deferred.
- **`b2_application_key.main.bucket_id` deprecation** — the `Backblaze/b2`
  provider deprecated `bucket_id` in favor of `bucket_ids` (plural). Plan
  output shows a deprecation warning; non-blocking, update when convenient.
- **Re-enable `plan-production`/`drift-production`** — see
  [Production jobs are temporarily disabled](#production-jobs-are-temporarily-disabled)
  above.
