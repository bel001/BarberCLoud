resource "aws_cloudwatch_event_rule" "maintenance" {
  name                = "${local.prefix}-maintenance"
  description         = "Revisa reservas vencidas y tareas administrativas."
  schedule_expression = "rate(1 hour)"
}

resource "aws_cloudwatch_event_target" "maintenance" {
  rule      = aws_cloudwatch_event_rule.maintenance.name
  target_id = "ManageServices"
  arn       = aws_lambda_function.functions["manage_services"].arn
}

resource "aws_lambda_permission" "eventbridge" {
  statement_id  = "AllowEventBridgeMaintenance"
  action        = "lambda:InvokeFunction"
  function_name = aws_lambda_function.functions["manage_services"].function_name
  principal     = "events.amazonaws.com"
  source_arn    = aws_cloudwatch_event_rule.maintenance.arn
}
