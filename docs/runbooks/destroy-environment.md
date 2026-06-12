# Runbook: Destroy an Environment

Tears down all Terraform-managed resources for a given environment.

**This is irreversible for most resources.** Destroying production will delete the B2 bucket,
Render service, and Supabase settings. Data in the bucket and database is NOT automatically
backed up by this process — back up first.

## Prerequisites

- Terraform CLI ≥ 1.9 (`terraform version`)
- Terraform Cloud access to the target workspace
- `terraform.tfvars` present with valid credentials (see `terraform.tfvars.example`)
- Explicit approval from a second team member for production

## Steps

### 1. Back up data (production only)

Before destroying production, snapshot the B2 bucket and export the Supabase database:

```bash
# Export Supabase schema + data
supabase db dump --project-ref <project_ref> -f backup-$(date +%Y%m%d).sql

# Sync B2 bucket to local (requires b2 CLI)
b2 sync b2://onye-dicom-production ./backup-b2-$(date +%Y%m%d)
```

### 2. Navigate to the environment directory

```bash
cd infra/envs/staging      # or production
```

### 3. Review what will be destroyed

```bash
terraform plan -destroy
```

Verify the list of resources. Confirm there is nothing unexpected — no resources
from other workloads sharing this environment.

### 4. Destroy

```bash
terraform destroy
```

Type `yes` when prompted. Destruction order is handled by the dependency graph;
the B2 application key is destroyed before the bucket.

### 5. Confirm workspace state is clean

After destroy completes, the Terraform Cloud workspace state should show 0 resources:

```bash
terraform show
# Should output: No state.
```

### 6. Clean up Terraform Cloud workspace (optional)

If the environment will not be re-provisioned, delete the workspace in the Terraform Cloud UI
under Settings → Workspaces to avoid orphaned state.

## Notes

- The `supabase_settings` resource only manages config (site_url, jwt_expiry). Destroying it
  does **not** delete the Supabase project — do that manually in the Supabase dashboard if needed.
- If destroy fails mid-way due to a provider error, re-run `terraform destroy`. Terraform
  is idempotent; already-deleted resources are simply skipped.
