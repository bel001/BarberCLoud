variable "aws_region" {
  type    = string
  default = "us-east-1"
}

variable "project_name" {
  type    = string
  default = "barbercloud"

  validation {
    condition     = can(regex("^[a-z0-9-]+$", var.project_name))
    error_message = "project_name solo puede contener minúsculas, números y guiones."
  }
}

variable "environment" {
  type    = string
  default = "dev"

  validation {
    condition     = contains(["dev", "staging", "prod"], var.environment)
    error_message = "environment debe ser dev, staging o prod."
  }
}

variable "ses_sender_email" {
  type        = string
  description = "Correo remitente previamente verificado en Amazon SES."

  validation {
    condition = (can(regex("^[^@[:space:]]+@[^@[:space:]]+\\.[^@[:space:]]+$", var.ses_sender_email)) &&
      !endswith(lower(var.ses_sender_email), "@example.com") &&
    !endswith(lower(var.ses_sender_email), ".invalid"))
    error_message = "ses_sender_email debe ser un correo real y verificable; no se aceptan dominios de ejemplo."
  }
}

variable "cloudfront_origin_access_control_id" {
  type        = string
  description = "ID del OAC compartido creado por iac/bootstrap."

  validation {
    condition     = can(regex("^[A-Z0-9]+$", var.cloudfront_origin_access_control_id))
    error_message = "cloudfront_origin_access_control_id debe ser un ID válido de CloudFront."
  }
}

variable "allowed_origins" {
  type        = list(string)
  description = "Orígenes adicionales autorizados por CORS. CloudFront se agrega automáticamente."
  default     = ["http://localhost:8080"]

  validation {
    condition = !contains(var.allowed_origins, "*") && alltrue([
      for origin in var.allowed_origins : can(regex("^https?://[^/]+$", origin))
    ])
    error_message = "allowed_origins no acepta comodines ni rutas; use orígenes HTTP(S) completos."
  }
}

variable "frontend_callback_urls" {
  type    = list(string)
  default = ["http://localhost:8080/callback.html"]

  validation {
    condition     = alltrue([for url in var.frontend_callback_urls : can(regex("^https?://", url))])
    error_message = "Cada callback debe ser una URL HTTP(S) completa."
  }
}

variable "frontend_logout_urls" {
  type    = list(string)
  default = ["http://localhost:8080/index.html"]

  validation {
    condition     = alltrue([for url in var.frontend_logout_urls : can(regex("^https?://", url))])
    error_message = "Cada logout URL debe ser una URL HTTP(S) completa."
  }
}
