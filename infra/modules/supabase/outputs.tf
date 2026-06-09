output "project_ref" {
  description = "Supabase project reference ID."
  value       = var.project_ref
}

output "api_url" {
  description = "Supabase project REST API URL."
  value       = "https://${var.project_ref}.supabase.co"
}
