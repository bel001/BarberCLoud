resource "aws_sns_topic" "reservas" {
  name = "${local.name}-reservas-topic"
}

resource "aws_sns_topic" "disponibilidad" {
  name = "${local.name}-disponibilidad-topic"
}

resource "aws_sqs_queue" "notificaciones" {
  name                       = "${local.name}-notificaciones-queue"
  message_retention_seconds  = 345600
  visibility_timeout_seconds = 60
}

resource "aws_sns_topic_subscription" "reserva_lambda" {
  topic_arn = aws_sns_topic.reservas.arn
  protocol  = "lambda"
  endpoint  = aws_lambda_function.functions["notificar_reserva"].arn

  filter_policy = jsonencode({
    eventType = ["RESERVA_CREADA"]
  })
}

resource "aws_sns_topic_subscription" "cancelacion_lambda" {
  topic_arn = aws_sns_topic.reservas.arn
  protocol  = "lambda"
  endpoint  = aws_lambda_function.functions["notificar_cancelacion"].arn

  filter_policy = jsonencode({
    eventType = ["RESERVA_CANCELADA"]
  })
}

resource "aws_sns_topic_subscription" "notificaciones_queue" {
  topic_arn = aws_sns_topic.reservas.arn
  protocol  = "sqs"
  endpoint  = aws_sqs_queue.notificaciones.arn
}

resource "aws_sns_topic_subscription" "availability_consumer" {
  topic_arn = aws_sns_topic.disponibilidad.arn
  protocol  = "lambda"
  endpoint  = aws_lambda_function.functions["lambda_consumer_avail"].arn
}

data "aws_iam_policy_document" "notificaciones_queue" {
  statement {
    actions   = ["sqs:SendMessage"]
    resources = [aws_sqs_queue.notificaciones.arn]

    principals {
      type        = "Service"
      identifiers = ["sns.amazonaws.com"]
    }

    condition {
      test     = "ArnEquals"
      variable = "aws:SourceArn"
      values   = [aws_sns_topic.reservas.arn]
    }
  }
}

resource "aws_sqs_queue_policy" "notificaciones" {
  queue_url = aws_sqs_queue.notificaciones.id
  policy    = data.aws_iam_policy_document.notificaciones_queue.json
}

resource "aws_lambda_permission" "sns_reserva" {
  statement_id  = "AllowReservaTopic"
  action        = "lambda:InvokeFunction"
  function_name = aws_lambda_function.functions["notificar_reserva"].function_name
  principal     = "sns.amazonaws.com"
  source_arn    = aws_sns_topic.reservas.arn
}

resource "aws_lambda_permission" "sns_cancelacion" {
  statement_id  = "AllowCancelacionTopic"
  action        = "lambda:InvokeFunction"
  function_name = aws_lambda_function.functions["notificar_cancelacion"].function_name
  principal     = "sns.amazonaws.com"
  source_arn    = aws_sns_topic.reservas.arn
}

resource "aws_lambda_permission" "sns_availability" {
  statement_id  = "AllowAvailabilityTopic"
  action        = "lambda:InvokeFunction"
  function_name = aws_lambda_function.functions["lambda_consumer_avail"].function_name
  principal     = "sns.amazonaws.com"
  source_arn    = aws_sns_topic.disponibilidad.arn
}

resource "aws_lambda_event_source_mapping" "notificaciones_queue" {
  event_source_arn = aws_sqs_queue.notificaciones.arn
  function_name    = aws_lambda_function.functions["sqs_notification_consumer"].arn
  batch_size       = 5
  enabled          = true
}

resource "aws_ses_email_identity" "sender" {
  email = var.ses_sender_email
}
