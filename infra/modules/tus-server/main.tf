terraform {
  required_providers {
    render = {
      source  = "render-oss/render"
      version = "~> 1.3"
    }
  }
}

locals {
  # Split "registry/repo:tag" into image_url + tag — render_web_service
  # requires image_url without a tag or digest.
  docker_image_parts = regex("^(.+):([^:/]+)$", var.docker_image)
  docker_image_url   = local.docker_image_parts[0]
  docker_image_tag   = local.docker_image_parts[1]
}

resource "render_web_service" "tus_server" {
  name   = var.service_name
  plan   = var.plan
  region = var.region

  runtime_source = {
    image = {
      image_url = local.docker_image_url
      tag       = local.docker_image_tag
    }
  }

  env_vars = {
    NODE_ENV = {
      value = var.environment
    }
    B2_KEY_ID = {
      value = var.b2_key_id
    }
    B2_APPLICATION_KEY = {
      value = var.b2_application_key
    }
    B2_BUCKET_NAME = {
      value = var.b2_bucket_name
    }
    SUPABASE_URL = {
      value = var.supabase_url
    }
    SUPABASE_SERVICE_ROLE_KEY = {
      value = var.supabase_service_role_key
    }
  }

  health_check_path = "/health"
}
