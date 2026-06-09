variable "bucket_name" {
  description = "Globally unique Backblaze B2 bucket name."
  type        = string
}

variable "allowed_origins" {
  description = "CORS allowed origins for browser direct-upload."
  type        = list(string)
}

variable "key_name" {
  description = "Name for the scoped B2 application key."
  type        = string
}
