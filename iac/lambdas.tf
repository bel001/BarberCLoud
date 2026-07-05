data "archive_file" "lambda_package" {
  type        = "zip"
  source_dir  = "${path.module}/../backend"
  output_path = "${path.module}/lambda.zip"
}

resource "aws_lambda_function" "functions" {
  #checkov:skip=CKV_AWS_117:Las Lambdas no usan VPC porque acceden a servicios administrados serverless sin recursos privados.
  #checkov:skip=CKV_AWS_272:Code Signing se deja fuera para el despliegue academico; el paquete se controla desde CI y commits.

  for_each = local.lambda_functions

  function_name                  = "${local.name}-${replace(each.key, "_", "-")}"
  role                           = aws_iam_role.lambda_role.arn
  handler                        = each.value
  runtime                        = "nodejs20.x"
  filename                       = data.archive_file.lambda_package.output_path
  source_code_hash               = data.archive_file.lambda_package.output_base64sha256
  timeout                        = 15
  memory_size                    = var.lambda_memory_size
  kms_key_arn                    = aws_kms_key.app.arn
  reserved_concurrent_executions = var.lambda_reserved_concurrent

  tracing_config {
    mode = "Active"
  }

  dead_letter_config {
    target_arn = aws_sqs_queue.lambda_dlq.arn
  }

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
    aws_cloudwatch_log_group.lambda
  ]
}

resource "aws_cloudwatch_log_group" "lambda" {
  for_each = local.lambda_functions

  name              = "/aws/lambda/${local.name}-${replace(each.key, "_", "-")}"
  kms_key_id        = aws_kms_key.app.arn
  retention_in_days = 365
}

resource "aws_cloudwatch_log_group" "post_confirm_cliente" {
  name              = "/aws/lambda/${local.name}-post-confirm-cliente"
  kms_key_id        = aws_kms_key.app.arn
  retention_in_days = 365
}

resource "aws_lambda_function" "post_confirm_cliente" {
  #checkov:skip=CKV_AWS_117:La Lambda de confirmacion Cognito no requiere VPC para escribir en DynamoDB.
  #checkov:skip=CKV_AWS_272:Code Signing se deja fuera para el despliegue academico; el paquete se controla desde CI y commits.

  function_name                  = "${local.name}-post-confirm-cliente"
  role                           = aws_iam_role.lambda_role.arn
  handler                        = "src/handlers/postConfirmCliente.handler"
  runtime                        = "nodejs20.x"
  filename                       = data.archive_file.lambda_package.output_path
  source_code_hash               = data.archive_file.lambda_package.output_base64sha256
  timeout                        = 15
  memory_size                    = var.lambda_memory_size
  kms_key_arn                    = aws_kms_key.app.arn
  reserved_concurrent_executions = var.lambda_reserved_concurrent

  tracing_config {
    mode = "Active"
  }

  dead_letter_config {
    target_arn = aws_sqs_queue.lambda_dlq.arn
  }

  environment {
    variables = {
      TABLE_NAME                          = aws_dynamodb_table.barbercloud.name
      AWS_NODEJS_CONNECTION_REUSE_ENABLED = "1"
    }
  }

  depends_on = [
    aws_cloudwatch_log_group.post_confirm_cliente
  ]
}
