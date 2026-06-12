terraform {
  required_providers {
    supabase = {
      source  = "supabase/supabase"
      version = "~> 1.0"
    }
  }
}

# Configures settings on the existing Supabase project — does not create it.
# Projects are created manually via the Supabase dashboard; Terraform
# manages configuration settings only.
#
# NOTE: RLS policies are NOT managed here. They live in
# supabase/migrations/*.sql and are applied via `supabase db push`.
resource "supabase_settings" "auth" {
  project_ref = var.project_ref

  auth = jsonencode({
    site_url                = var.environment == "production" ? "https://app.onye.health" : "https://staging.onye.health"
    additional_redirect_urls = []
    jwt_expiry              = 3600
    enable_signup           = true
    mailer_autoconfirm      = var.environment == "staging"
  })
}
