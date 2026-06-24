resource "aws_cloudwatch_event_rule" "scheduled_availability" {
  name                = "${local.name}-scheduled-availability"
  description         = "Actualizacion programada de disponibilidad"
  schedule_expression = "rate(1 hour)"
}

resource "aws_cloudwatch_event_rule" "scheduled_administration" {
  name                = "${local.name}-scheduled-administration"
  description         = "Procesos administrativos programados"
  schedule_expression = "rate(1 day)"
}

resource "aws_cloudwatch_event_rule" "system_scheduler" {
  name                = "${local.name}-system-scheduler"
  description         = "Disparador programado del sistema"
  schedule_expression = "rate(6 hours)"
}

resource "aws_cloudwatch_event_target" "availability_to_sns" {
  rule      = aws_cloudwatch_event_rule.scheduled_availability.name
  target_id = "sns-disponibilidad"
  arn       = aws_sns_topic.disponibilidad.arn
}

resource "aws_cloudwatch_event_target" "admin_to_lambda" {
  rule      = aws_cloudwatch_event_rule.scheduled_administration.name
  target_id = "lambda-consumer-admin"
  arn       = aws_lambda_function.functions["lambda_consumer_admin"].arn
}

resource "aws_cloudwatch_event_target" "system_scheduler_to_admin" {
  rule      = aws_cloudwatch_event_rule.system_scheduler.name
  target_id = "system-scheduler-admin"
  arn       = aws_lambda_function.functions["lambda_consumer_admin"].arn
}

data "aws_iam_policy_document" "disponibilidad_topic" {
  statement {
    actions   = ["sns:Publish"]
    resources = [aws_sns_topic.disponibilidad.arn]

    principals {
      type        = "Service"
      identifiers = ["events.amazonaws.com"]
    }
  }
}

resource "aws_sns_topic_policy" "disponibilidad" {
  arn    = aws_sns_topic.disponibilidad.arn
  policy = data.aws_iam_policy_document.disponibilidad_topic.json
}

resource "aws_lambda_permission" "eventbridge_admin" {
  statement_id  = "AllowScheduledAdministration"
  action        = "lambda:InvokeFunction"
  function_name = aws_lambda_function.functions["lambda_consumer_admin"].function_name
  principal     = "events.amazonaws.com"
  source_arn    = aws_cloudwatch_event_rule.scheduled_administration.arn
}

resource "aws_lambda_permission" "eventbridge_system_scheduler" {
  statement_id  = "AllowSystemScheduler"
  action        = "lambda:InvokeFunction"
  function_name = aws_lambda_function.functions["lambda_consumer_admin"].function_name
  principal     = "events.amazonaws.com"
  source_arn    = aws_cloudwatch_event_rule.system_scheduler.arn
}
