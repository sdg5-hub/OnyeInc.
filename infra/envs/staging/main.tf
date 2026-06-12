terraform {
  cloud {
    organization = "onye-dev" # replace with your Terraform Cloud org name
    workspaces {
      name = "onye-radiology-staging"
    }
  }

  required_providers {
    b2 = {
      source  = "Backblaze/b2"
      version = "~> 0.8"
    }
    supabase = {
      source  = "supabase/supabase"
      version = "~> 1.0"
    }
    render = {
      source  = "render-oss/render"
      version = "~> 1.3"
    }
  }
}

# ── Providers ────────────────────────────────────────────────────────────────
# Credentials are injected via TFC workspace variables — never hardcoded.

provider "b2" {
  application_key_id = var.b2_master_key_id
  application_key    = var.b2_master_key
}

provider "supabase" {
  access_token = var.supabase_access_token
}

provider "render" {
  api_key = var.render_api_key
  owner_id = var.render_owner_id
}

# ── B2 bucket ────────────────────────────────────────────────────────────────

module "b2" {
  source = "../../modules/b2"

  bucket_name     = "onye-dicom-staging"
  key_name        = "onye-tus-staging"
  allowed_origins = var.b2_allowed_origins
}

# ── Supabase ─────────────────────────────────────────────────────────────────

module "supabase" {
  source = "../../modules/supabase"

  project_ref = var.supabase_project_ref
  environment = "staging"
}

# ── Tus server (Render) ───────────────────────────────────────────────────────

module "tus_server" {
  source = "../../modules/tus-server"

  service_name  = "onye-tus-staging"
  environment   = "staging"
  plan          = "starter"
  region        = "oregon"
  docker_image  = var.tus_docker_image

  b2_key_id          = module.b2.application_key_id
  b2_application_key = module.b2.application_key
  b2_bucket_name     = module.b2.bucket_name

  supabase_url              = module.supabase.api_url
  supabase_service_role_key = var.supabase_service_role_key
}
