variable "project_name" {
  type    = string
  default = "barbercloud"
}

variable "aws_region" {
  type    = string
  default = "us-east-1"
}

variable "ses_sender_email" {
  type        = string
  description = "Correo verificado en SES para enviar notificaciones"
  default     = "no-reply@barbercloud.com"
}

variable "frontend_bucket_name" {
  type        = string
  description = "Nombre opcional del bucket S3 para frontend. Si queda vacio se genera con project_name."
  default     = ""
}

variable "cognito_domain_prefix" {
  type        = string
  description = "Prefijo opcional para el dominio Hosted UI de Cognito. Debe ser globalmente unico."
  default     = ""
}
