variable "b2_master_key_id" {
  description = "Backblaze B2 master application key ID."
  type        = string
  sensitive   = true
}

variable "b2_master_key" {
  description = "Backblaze B2 master application key secret."
  type        = string
  sensitive   = true
}

variable "supabase_access_token" {
  description = "Supabase personal access token (from account settings)."
  type        = string
  sensitive   = true
}

variable "supabase_project_ref" {
  description = "Supabase staging project reference ID."
  type        = string
}

variable "supabase_service_role_key" {
  description = "Supabase service role JWT for the staging project."
  type        = string
  sensitive   = true
}

variable "render_api_key" {
  description = "Render API key."
  type        = string
  sensitive   = true
}

variable "render_owner_id" {
  description = "Render owner/team ID (from Render account settings)."
  type        = string
}

variable "tus_docker_image" {
  description = "Fully qualified Docker image for the Tus server (e.g. ghcr.io/onye/tus-server:latest)."
  type        = string
}

variable "b2_allowed_origins" {
  description = "CORS allowed origins for the staging B2 bucket (browser direct-upload)."
  type        = list(string)
  default     = ["https://staging.onye.health"]
}
