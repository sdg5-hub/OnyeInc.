terraform {
  required_providers {
    b2 = {
      source  = "Backblaze/b2"
      version = "~> 0.8"
    }
  }
}

resource "b2_bucket" "main" {
  bucket_name = var.bucket_name
  bucket_type = "allPrivate"

  cors_rules {
    cors_rule_name     = "onye-app"
    allowed_origins    = var.allowed_origins
    allowed_operations = ["b2_upload_file", "b2_download_file_by_name", "b2_download_file_by_id"]
    expose_headers     = []
    max_age_seconds    = 3600
  }

  default_server_side_encryption {
    mode      = "SSE-B2"
    algorithm = "AES256"
  }

  lifecycle_rules {
    file_name_prefix              = ""
    days_from_hiding_to_deleting  = 30
    days_from_uploading_to_hiding = null
  }
}

# Scoped key — only grants access to this bucket.
# The application_key value is only available at creation time.
# Terraform Cloud stores it in state (encrypted). Read it from outputs
# immediately after apply and store in the environment's secret manager.
resource "b2_application_key" "main" {
  key_name     = var.key_name
  bucket_id    = b2_bucket.main.bucket_id
  capabilities = ["listBuckets", "listFiles", "readFiles", "writeFiles", "deleteFiles"]
}
