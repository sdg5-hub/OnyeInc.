# Runbook: Roll Back the Tus Server

Reverts the Tus server on Render to a previous Docker image without a full Terraform apply.

## When to use this

- A new image was deployed and is producing errors (5xx, upload failures, health check failures)
- You need to revert faster than the CI/CD pipeline allows

## Prerequisites

- Render API key (same one in `TF_VAR_render_api_key`)
- Render service ID — retrieve it from Terraform outputs:

```bash
cd infra/envs/staging    # or production
terraform output         # look for service_id if exposed, or check Render dashboard
```

- The image tag you want to roll back to (check GitHub Container Registry or your deployment history)

## Option A — Update Terraform config (recommended)

This keeps Terraform state and reality in sync.

### 1. Update `tus_docker_image` in your environment config

```bash
cd infra/envs/staging    # or production
```

In [infra/envs/staging/main.tf](../../infra/envs/staging/main.tf), update the `tus_docker_image`
variable value to the previous known-good tag (or update `terraform.tfvars`):

```hcl
tus_docker_image = "ghcr.io/onye/tus-server:sha-<previous-sha>"
```

### 2. Plan and apply

```bash
terraform plan
terraform apply
```

Render triggers a new deploy with the pinned image. Monitor the Render dashboard for deploy status.

### 3. Verify health

```bash
curl -I "$(terraform output -raw tus_server_url)/health"
# Expect: HTTP/2 200
```

## Option B — Render dashboard (emergency, bypasses Terraform)

Use when you need to rollback in under 2 minutes and can't wait for Terraform.

1. Open [render.com/dashboard](https://render.com/dashboard)
2. Select the Tus server service
3. Go to **Deploys** tab
4. Find the last successful deploy
5. Click **Re-deploy** on that deploy

**Important**: After using Option B, update `tus_docker_image` in `terraform.tfvars` to match
the re-deployed image tag, then run `terraform apply` so state reflects reality. Leaving Terraform
state out of sync causes the next apply to re-deploy the wrong image.

## Verify upload flow after rollback

```bash
# Upload a small test file via the Tus protocol
curl -X POST "$(terraform output -raw tus_server_url)/uploads" \
  -H "Tus-Resumable: 1.0.0" \
  -H "Upload-Length: 0" \
  -H "Content-Length: 0"
# Expect: HTTP 201 with Location header
```

A `201` with a `Location` header confirms the Tus server is accepting uploads.
