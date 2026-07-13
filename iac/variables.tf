variable "aws_region" {
  type    = string
  default = "us-east-1"
}

variable "project_name" {
  type    = string
  default = "barbercloud"
}

variable "environment" {
  type    = string
  default = "dev"
}

variable "ses_sender_email" {
  type        = string
  description = "Correo remitente previamente verificado en Amazon SES."
  default     = "no-reply@example.com"
}

variable "allowed_origins" {
  type        = list(string)
  description = "Orígenes autorizados por CORS. En producción use el dominio CloudFront."
  default     = ["*"]
}

variable "frontend_callback_urls" {
  type    = list(string)
  default = ["http://localhost:8080/callback.html"]
}

variable "frontend_logout_urls" {
  type    = list(string)
  default = ["http://localhost:8080/index.html"]
}
