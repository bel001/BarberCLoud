resource "aws_sns_topic" "reservas" {
  name = "${local.name}-reservas-topic"

  tags = local.common_tags
}

resource "aws_sqs_queue" "notificaciones" {
  name = "${local.name}-notificaciones-queue"

  tags = local.common_tags
}

resource "aws_sns_topic_subscription" "cancelaciones_queue" {
  topic_arn = aws_sns_topic.reservas.arn
  protocol  = "sqs"
  endpoint  = aws_sqs_queue.notificaciones.arn
}

resource "aws_ses_email_identity" "sender" {
  email = var.ses_sender_email
}
