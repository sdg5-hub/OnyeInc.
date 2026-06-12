variable "project_ref" {
  description = "Supabase project reference ID (found in project settings URL)."
  type        = string
}

variable "environment" {
  description = "Deployment environment: staging or production."
  type        = string
  validation {
    condition     = contains(["staging", "production"], var.environment)
    error_message = "environment must be staging or production."
  }
}
