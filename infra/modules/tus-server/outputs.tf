output "service_url" {
  description = "Public HTTPS URL of the deployed Tus server on Render."
  value       = render_web_service.tus_server.url
}

output "service_id" {
  description = "Render service ID (used for manual rollbacks via the Render API)."
  value       = render_web_service.tus_server.id
}
