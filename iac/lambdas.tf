data "archive_file" "backend" {
  type        = "zip"
  source_dir  = "${path.module}/../backend"
  output_path = "${path.module}/backend.zip"
  excludes    = ["test", "coverage", ".dockerignore", "Dockerfile"]
}

resource "aws_lambda_function" "functions" {
  #checkov:skip=CKV_AWS_117:Las funciones solo consumen servicios públicos administrados de AWS; una VPC exigiría NAT o endpoints y no protege ningún recurso privado actual.
  #checkov:skip=CKV_AWS_272:El paquete se genera localmente con archive_file; la firma se incorporará cuando exista un pipeline de artefactos con AWS Signer.
  for_each = local.lambda_handlers

  function_name = "${local.prefix}-${replace(each.key, "_", "-")}"
  role          = aws_iam_role.lambda[each.key].arn
  runtime       = "nodejs24.x"
  handler       = each.value

  filename         = data.archive_file.backend.output_path
  source_code_hash = data.archive_file.backend.output_base64sha256
  timeout          = 15
  memory_size      = 256

  reserved_concurrent_executions = var.lambda_reserved_concurrent_executions
  kms_key_arn                    = aws_kms_key.application.arn

  dead_letter_config {
    target_arn = aws_sqs_queue.lambda_dlq.arn
  }

  tracing_config {
    mode = "Active"
  }

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

  depends_on = [aws_iam_role_policy.lambda]
}

resource "aws_cloudwatch_log_group" "lambda" {
  for_each = local.lambda_handlers

  name              = "/aws/lambda/${local.prefix}-${replace(each.key, "_", "-")}"
  retention_in_days = 365
  kms_key_id        = aws_kms_key.cloudwatch_logs.arn
}

resource "aws_lambda_function" "post_confirm_client" {
  #checkov:skip=CKV_AWS_117:La función solo usa DynamoDB y Cognito públicos; una VPC agregaría NAT o endpoints sin acceder a recursos privados.
  #checkov:skip=CKV_AWS_272:El paquete se genera localmente con archive_file; la firma se incorporará cuando exista un pipeline de artefactos con AWS Signer.
  function_name = "${local.prefix}-post-confirm-client"
  role          = aws_iam_role.post_confirm_client.arn
  runtime       = "nodejs24.x"
  handler       = "src/handlers/postConfirmCliente.handler"

  filename         = data.archive_file.backend.output_path
  source_code_hash = data.archive_file.backend.output_base64sha256
  timeout          = 15
  memory_size      = 256

  reserved_concurrent_executions = var.lambda_reserved_concurrent_executions
  kms_key_arn                    = aws_kms_key.application.arn

  dead_letter_config {
    target_arn = aws_sqs_queue.lambda_dlq.arn
  }

  tracing_config {
    mode = "Active"
  }

  environment {
    variables = {
      TABLE_NAME = aws_dynamodb_table.main.name
      NODE_ENV   = "production"
    }
  }

  depends_on = [aws_iam_role_policy.post_confirm_client]
}

resource "aws_cloudwatch_log_group" "post_confirm_client" {
  name              = "/aws/lambda/${local.prefix}-post-confirm-client"
  retention_in_days = 365
  kms_key_id        = aws_kms_key.cloudwatch_logs.arn
}
