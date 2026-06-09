# ADR-003 — IaC Tooling: Terraform, Render, Terraform Cloud

**Date:** 2026-06-09
**Status:** Accepted
**Ticket:** IC-INFRA-01

## Context

IC-INFRA-01 requires all cloud infrastructure to be defined as code with
separate staging and production environments, a CI/CD plan gate on every PR,
and drift detection. Three tool decisions were required before implementation
could begin.

## Decisions

### 1. IaC tool — Terraform (over Pulumi)

Terraform has mature, first-party providers for every service in this stack
(Backblaze B2, Supabase, Render, Cloudflare). The HCL syntax is widely
understood by engineers who may join the team. Pulumi offers better
programming-language integration but adds runtime complexity (Python/Node
process) with no benefit for the resource types this project uses.

### 2. Tus server host — Render (over Railway)

Render has an official Terraform provider (`render-oss/render`), making the
service definition fully IaC-managed. Railway's Terraform support is
experimental. Render's free and starter plans cover MVP traffic, and its
Docker-native deployment model matches the existing `Dockerfile` in the repo.

### 3. Terraform state backend — Terraform Cloud free tier (over B2 or local)

Local state breaks with any second contributor and has no locking. A B2 bucket
backend requires manual bootstrapping (the bucket must exist before Terraform
runs) and does not support state locking natively. Terraform Cloud provides
remote state, built-in locking, run history, and a GitHub Actions integration
via API token — all on the free tier, which covers the full MVP resource count.

## Consequences

- A Terraform Cloud organisation named `onye` must be created at app.terraform.io
  before `terraform init` can run.
- All `terraform apply` runs for production must be performed manually from
  Terraform Cloud's UI or CLI — never auto-applied by CI.
- RLS policies are **not** managed by Terraform. They live in Supabase SQL
  migration files and are applied via the Supabase CLI. Terraform manages
  project-level settings only.
- If the Render provider API changes, the `infra/modules/tus-server/` module
  will need updating. Pin provider versions in `required_providers` to
  prevent surprise breakage.
