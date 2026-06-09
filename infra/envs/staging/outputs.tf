output "b2_bucket_name" {
  value = module.b2.bucket_name
}

output "b2_bucket_url" {
  value = module.b2.bucket_url
}

output "tus_server_url" {
  value = module.tus_server.service_url
}

output "supabase_api_url" {
  value = module.supabase.api_url
}
