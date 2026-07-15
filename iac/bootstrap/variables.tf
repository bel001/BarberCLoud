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

variable "github_repository" {
  type        = string
  description = "Repositorio autorizado para asumir el rol OIDC, con formato owner/repo."
  default     = "bel001/BarberCLoud"

  validation {
    condition     = can(regex("^[A-Za-z0-9_.-]+/[A-Za-z0-9_.-]+$", var.github_repository))
    error_message = "github_repository debe usar el formato owner/repo."
  }
}

variable "github_environments" {
  type        = set(string)
  description = "GitHub Environments para los que se crea un rol OIDC aislado."
  default     = ["dev", "prod"]

  validation {
    condition = length(var.github_environments) > 0 && alltrue([
      for environment in var.github_environments : can(regex("^[A-Za-z0-9_.-]+$", environment))
    ])
    error_message = "github_environments debe contener al menos un nombre válido."
  }
}
