resource "aws_ssm_parameter" "table_name" {
  name  = "/${local.prefix}/table-name"
  type  = "String"
  value = aws_dynamodb_table.main.name
}

resource "aws_ssm_parameter" "reservation_topic" {
  name  = "/${local.prefix}/reservation-topic-arn"
  type  = "String"
  value = aws_sns_topic.reservation_created.arn
}

resource "aws_ssm_parameter" "cancellation_topic" {
  name  = "/${local.prefix}/cancellation-topic-arn"
  type  = "String"
  value = aws_sns_topic.reservation_cancelled.arn
}

resource "aws_cloudwatch_metric_alarm" "lambda_errors" {
  alarm_name          = "${local.prefix}-lambda-errors"
  comparison_operator = "GreaterThanThreshold"
  evaluation_periods  = 1
  metric_name         = "Errors"
  namespace           = "AWS/Lambda"
  period              = 300
  statistic           = "Sum"
  threshold           = 0
  alarm_description   = "Alerta cuando alguna Lambda del proyecto reporta errores."

  dimensions = {
    FunctionName = aws_lambda_function.functions["reservas_cliente"].function_name
  }
}
