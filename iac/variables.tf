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
