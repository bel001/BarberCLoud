data "archive_file" "lambda_package" {
  type        = "zip"
  source_dir  = "${path.module}/../backend"
  output_path = "${path.module}/lambda.zip"
}

resource "aws_lambda_function" "functions" {
  for_each = local.lambda_functions

  function_name    = "${local.name}-${replace(each.key, "_", "-")}"
  role             = aws_iam_role.lambda_role.arn
  handler          = each.value
  runtime          = "nodejs20.x"
  filename         = data.archive_file.lambda_package.output_path
  source_code_hash = data.archive_file.lambda_package.output_base64sha256
  timeout          = 15
  memory_size      = 256

  environment {
    variables = {
      TABLE_NAME                          = aws_dynamodb_table.barbercloud.name
      TOPIC_ARN                           = aws_sns_topic.reservas.arn
      AVAILABILITY_TOPIC_ARN              = aws_sns_topic.disponibilidad.arn
      NOTIFICATION_QUEUE_URL              = aws_sqs_queue.notificaciones.url
      SES_SENDER_EMAIL                    = var.ses_sender_email
      USER_POOL_ID                        = aws_cognito_user_pool.users.id
      AWS_NODEJS_CONNECTION_REUSE_ENABLED = "1"
    }
  }

  depends_on = [
    aws_iam_role_policy_attachment.lambda_attach,
    aws_cloudwatch_log_group.lambda
  ]
}

resource "aws_cloudwatch_log_group" "lambda" {
  for_each = local.lambda_functions

  name              = "/aws/lambda/${local.name}-${replace(each.key, "_", "-")}"
  retention_in_days = 14
}
