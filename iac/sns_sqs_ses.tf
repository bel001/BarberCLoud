resource "aws_sns_topic" "reservation_created" {
  name              = "${local.prefix}-reservation-created"
  kms_master_key_id = "alias/aws/sns"
}

resource "aws_sns_topic" "reservation_cancelled" {
  name              = "${local.prefix}-reservation-cancelled"
  kms_master_key_id = "alias/aws/sns"
}

resource "aws_sqs_queue" "notification_retry" {
  name                       = "${local.prefix}-notification-retry"
  visibility_timeout_seconds = 60
  message_retention_seconds  = 345600
  kms_master_key_id          = aws_kms_key.application.arn
}

resource "aws_sqs_queue" "lambda_dlq" {
  name                      = "${local.prefix}-lambda-dlq"
  message_retention_seconds = 1209600
  kms_master_key_id         = aws_kms_key.application.arn
}

resource "aws_sns_topic_subscription" "created_lambda" {
  topic_arn = aws_sns_topic.reservation_created.arn
  protocol  = "lambda"
  endpoint  = aws_lambda_function.functions["notificar_reserva"].arn
}

resource "aws_sns_topic_subscription" "cancelled_lambda" {
  topic_arn = aws_sns_topic.reservation_cancelled.arn
  protocol  = "lambda"
  endpoint  = aws_lambda_function.functions["notificar_cancelacion"].arn
}

resource "aws_lambda_permission" "sns_created" {
  statement_id  = "AllowReservationTopic"
  action        = "lambda:InvokeFunction"
  function_name = aws_lambda_function.functions["notificar_reserva"].function_name
  principal     = "sns.amazonaws.com"
  source_arn    = aws_sns_topic.reservation_created.arn
}

resource "aws_lambda_permission" "sns_cancelled" {
  statement_id  = "AllowCancellationTopic"
  action        = "lambda:InvokeFunction"
  function_name = aws_lambda_function.functions["notificar_cancelacion"].function_name
  principal     = "sns.amazonaws.com"
  source_arn    = aws_sns_topic.reservation_cancelled.arn
}

resource "aws_lambda_event_source_mapping" "retry_queue" {
  event_source_arn = aws_sqs_queue.notification_retry.arn
  function_name    = aws_lambda_function.functions["notificar_cancelacion"].arn
  batch_size       = 5
}

resource "aws_ses_email_identity" "sender" {
  email = var.ses_sender_email

  lifecycle {
    prevent_destroy = true
  }
}
