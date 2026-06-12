# Runbook: Provision an Environment

Provisions or updates staging or production infrastructure via Terraform.

## Prerequisites

- Terraform CLI ≥ 1.9 installed (`terraform version`)
- Terraform Cloud account with access to the `onye-dev` organisation
- API tokens and credentials for B2, Supabase, and Render (see `terraform.tfvars.example`)
- Authenticated: `terraform login` (stores token in `~/.terraform.d/credentials.tfrc.json`)
- **Terraform Cloud workspace variables configured** — the `onye-radiology-staging` /
  `onye-radiology-production` workspaces must have every variable from the
  [Secrets reference](#secrets-reference) table set as a Terraform variable.
  CI (`terraform-plan.yml`, `terraform-drift.yml`) has **no local `terraform.tfvars`** —
  it relies entirely on these workspace variables. For `b2_allowed_origins`
  (a `list(string)`), enable the **HCL** checkbox on that variable, or
  Terraform Cloud will pass it as a quoted string and `plan` will fail with
  `list of string required, but have string`.

## Run everything from the repository root

All `terraform` commands below use `-chdir=infra/envs/<env>` and are run from
the **repository root** — not from inside `infra/envs/<env>`.

> **Why:** Terraform Cloud's CLI-driven runs upload a "configuration directory"
> determined by where `terraform` is invoked from. If you `cd infra/envs/staging`
> and run bare `terraform init`/`plan`, the upload boundary excludes
> `infra/modules/`, and Terraform fails with:
> ```
> Error: Unreadable module directory
> ... lstat ../../modules: no such file or directory
> ```
> Running `terraform -chdir=infra/envs/staging <command>` from the repo root
> uploads the whole repo root, resolving `../../modules/*` correctly. This is
> the same pattern used by `terraform-plan.yml`/`terraform-drift.yml` — see
> [terraform-ci.md](./terraform-ci.md).

## Steps

### 1. Create your local variables file

```bash
cp infra/envs/staging/terraform.tfvars.example infra/envs/staging/terraform.tfvars
# Edit infra/envs/staging/terraform.tfvars — fill in every placeholder value
# NEVER commit terraform.tfvars
```

Use `infra/envs/production/terraform.tfvars.example` for production.

### 2. Initialise Terraform

```bash
terraform -chdir=infra/envs/staging init
```

This pulls providers and connects to the Terraform Cloud workspace. First-time init may
prompt for workspace confirmation.

### 3. Review the plan

```bash
terraform -chdir=infra/envs/staging plan
```

Read the entire plan output before proceeding. Verify:

- No unexpected resource deletions (look for `- destroy`)
- Resource counts match expectations
- `sensitive` outputs are not printed in clear text

### 4. Apply

```bash
terraform -chdir=infra/envs/staging apply
```

Type `yes` when prompted. Apply streams resource creation events. Typical duration: 2–5 minutes.

### 5. Verify outputs

```bash
terraform -chdir=infra/envs/staging output
```

Confirm `tus_server_url` is reachable:

```bash
curl -I "$(terraform -chdir=infra/envs/staging output -raw tus_server_url)/health"
# Expect: HTTP/2 200
```

For production, replace `infra/envs/staging` with `infra/envs/production` throughout.

## Rollback

If apply partially fails, Terraform state may be inconsistent. Run `terraform -chdir=infra/envs/<env> plan`
again — it will show the delta between state and reality. Fix the underlying issue and re-apply; do not
manually delete resources without running `terraform destroy` first, as this orphans state.

For Tus server rollback specifically, see [rollback-tus-server.md](./rollback-tus-server.md).

## Secrets reference

| Terraform variable | Where to find it |
|---|---|
| `b2_master_key_id` | Backblaze B2 → Account → App Keys |
| `b2_master_key` | Backblaze B2 → Account → App Keys (shown once at creation) |
| `b2_allowed_origins` | List of frontend origins allowed to access the bucket via CORS — mark **HCL** in TFC |
| `supabase_access_token` | Supabase → Account → Access Tokens |
| `supabase_project_ref` | Supabase project → Settings → General → Reference ID |
| `supabase_service_role_key` | Supabase project → Settings → API → service_role key |
| `render_api_key` | Render → Account → API Keys |
| `render_owner_id` | Render → Account → Settings → Owner ID |
| `tus_docker_image` | GitHub Container Registry (ghcr.io/onye/tus-server) |
