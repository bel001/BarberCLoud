resource "aws_ssm_parameter" "table_name" {
  name  = "/${local.name}/table-name"
  type  = "String"
  value = aws_dynamodb_table.barbercloud.name

  tags = local.common_tags
}

resource "aws_cloudwatch_log_group" "api_logs" {
  name              = "/aws/apigateway/${local.name}"
  retention_in_days = 7

  tags = local.common_tags
}
