data "archive_file" "backend" {
  type        = "zip"
  source_dir  = "${path.module}/../backend"
  output_path = "${path.module}/backend.zip"
  excludes    = ["test", "coverage", ".dockerignore", "Dockerfile"]
}

resource "aws_lambda_function" "functions" {
  for_each = local.lambda_handlers

  function_name    = "${local.prefix}-${replace(each.key, "_", "-")}"
  role             = aws_iam_role.lambda.arn
  runtime          = "nodejs20.x"
  handler          = each.value
  filename         = data.archive_file.backend.output_path
  source_code_hash = data.archive_file.backend.output_base64sha256
  timeout          = 15
  memory_size      = 256

  environment {
    variables = {
      TABLE_NAME                          = aws_dynamodb_table.main.name
      AWS_NODEJS_CONNECTION_REUSE_ENABLED = "1"
      RESERVATION_TOPIC_ARN               = aws_sns_topic.reservation_created.arn
      CANCELLATION_TOPIC_ARN              = aws_sns_topic.reservation_cancelled.arn
      RETRY_QUEUE_URL                     = aws_sqs_queue.notification_retry.url
      SES_SENDER_EMAIL                    = var.ses_sender_email
      USER_POOL_ID                        = aws_cognito_user_pool.main.id
      NODE_ENV                            = "production"
    }
  }
}

resource "aws_cloudwatch_log_group" "lambda" {
  for_each          = local.lambda_handlers
  name              = "/aws/lambda/${local.prefix}-${replace(each.key, "_", "-")}"
  retention_in_days = 30
}

resource "aws_lambda_function" "post_confirm_client" {
  function_name    = "${local.prefix}-post-confirm-client"
  role             = aws_iam_role.lambda.arn
  runtime          = "nodejs20.x"
  handler          = "src/handlers/postConfirmCliente.handler"
  filename         = data.archive_file.backend.output_path
  source_code_hash = data.archive_file.backend.output_base64sha256
  timeout          = 15
  memory_size      = 256

  environment {
    variables = {
      TABLE_NAME = aws_dynamodb_table.main.name
      NODE_ENV   = "production"
    }
  }
}

resource "aws_cloudwatch_log_group" "post_confirm_client" {
  name              = "/aws/lambda/${local.prefix}-post-confirm-client"
  retention_in_days = 30
}
