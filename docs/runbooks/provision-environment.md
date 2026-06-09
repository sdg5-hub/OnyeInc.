# Runbook: Provision an Environment

Provisions or updates staging or production infrastructure via Terraform.

## Prerequisites

- Terraform CLI ≥ 1.9 installed (`terraform version`)
- Terraform Cloud account with access to the `onye-radiology` organisation
- API tokens and credentials for B2, Supabase, and Render (see `terraform.tfvars.example`)
- Authenticated: `terraform login` (stores token in `~/.terraform.d/credentials.tfrc.json`)

## Steps

### 1. Navigate to the environment directory

```bash
cd infra/envs/staging      # or production
```

### 2. Create your local variables file

```bash
cp terraform.tfvars.example terraform.tfvars
# Edit terraform.tfvars — fill in every placeholder value
# NEVER commit terraform.tfvars
```

### 3. Initialise Terraform

```bash
terraform init
```

This pulls providers and connects to the Terraform Cloud workspace. First-time init may
prompt for workspace confirmation.

### 4. Review the plan

```bash
terraform plan
```

Read the entire plan output before proceeding. Verify:

- No unexpected resource deletions (look for `- destroy`)
- Resource counts match expectations
- `sensitive` outputs are not printed in clear text

### 5. Apply

```bash
terraform apply
```

Type `yes` when prompted. Apply streams resource creation events. Typical duration: 2–5 minutes.

### 6. Verify outputs

```bash
terraform output
```

Confirm `tus_server_url` is reachable:

```bash
curl -I "$(terraform output -raw tus_server_url)/health"
# Expect: HTTP/2 200
```

## Rollback

If apply partially fails, Terraform state may be inconsistent. Run `terraform plan` again — it will
show the delta between state and reality. Fix the underlying issue and re-apply; do not manually
delete resources without running `terraform destroy` first, as this orphans state.

For Tus server rollback specifically, see [rollback-tus-server.md](./rollback-tus-server.md).

## Secrets reference

| Terraform variable | Where to find it |
|---|---|
| `b2_master_key_id` | Backblaze B2 → Account → App Keys |
| `b2_master_key` | Backblaze B2 → Account → App Keys (shown once at creation) |
| `supabase_access_token` | Supabase → Account → Access Tokens |
| `supabase_project_ref` | Supabase project → Settings → General → Reference ID |
| `supabase_service_role_key` | Supabase project → Settings → API → service_role key |
| `render_api_key` | Render → Account → API Keys |
| `render_owner_id` | Render → Account → Settings → Owner ID |
| `tus_docker_image` | GitHub Container Registry (ghcr.io/onye/tus-server) |
