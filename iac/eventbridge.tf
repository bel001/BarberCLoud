resource "aws_cloudwatch_event_rule" "scheduled_availability" {
  name                = "${local.name}-scheduled-availability"
  description         = "Actualizacion programada de disponibilidad"
  schedule_expression = "rate(1 hour)"

  tags = local.common_tags
}

resource "aws_cloudwatch_event_rule" "scheduled_administration" {
  name                = "${local.name}-scheduled-administration"
  description         = "Procesos administrativos programados"
  schedule_expression = "rate(1 day)"

  tags = local.common_tags
}
