variable "service_name" {
  description = "Render service name (must be unique within the Render account)."
  type        = string
}

variable "environment" {
  description = "Deployment environment: staging or production."
  type        = string
}

variable "plan" {
  description = "Render plan: free, starter, standard, pro."
  type        = string
  default     = "starter"
}

variable "region" {
  description = "Render deployment region."
  type        = string
  default     = "oregon"
}

variable "docker_image" {
  description = "Fully qualified Docker image reference for the Tus server."
  type        = string
}

variable "b2_key_id" {
  description = "Backblaze B2 application key ID."
  type        = string
  sensitive   = true
}

variable "b2_application_key" {
  description = "Backblaze B2 application key secret."
  type        = string
  sensitive   = true
}

variable "b2_bucket_name" {
  description = "Backblaze B2 bucket name for Tus uploads."
  type        = string
}

variable "supabase_url" {
  description = "Supabase project API URL."
  type        = string
}

variable "supabase_service_role_key" {
  description = "Supabase service role JWT (server-side only)."
  type        = string
  sensitive   = true
}
