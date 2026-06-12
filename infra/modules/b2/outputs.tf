output "bucket_id" {
  description = "Backblaze B2 bucket ID."
  value       = b2_bucket.main.bucket_id
}

output "bucket_name" {
  description = "Backblaze B2 bucket name."
  value       = b2_bucket.main.bucket_name
}

output "bucket_url" {
  description = "S3-compatible endpoint URL for the bucket."
  value       = "https://s3.us-west-004.backblazeb2.com/${b2_bucket.main.bucket_name}"
}

output "application_key_id" {
  description = "B2 application key ID for the Tus server."
  value       = b2_application_key.main.application_key_id
}

output "application_key" {
  description = "B2 application key secret. Sensitive — store in secret manager."
  value       = b2_application_key.main.application_key
  sensitive   = true
}
