resource "aws_ssm_parameter" "table_name" {
  name   = "/${local.name}/table-name"
  type   = "SecureString"
  key_id = aws_kms_key.app.arn
  value  = aws_dynamodb_table.barbercloud.name
}

resource "aws_ssm_parameter" "reservas_topic_arn" {
  name   = "/${local.name}/reservas-topic-arn"
  type   = "SecureString"
  key_id = aws_kms_key.app.arn
  value  = aws_sns_topic.reservas.arn
}

resource "aws_ssm_parameter" "disponibilidad_topic_arn" {
  name   = "/${local.name}/disponibilidad-topic-arn"
  type   = "SecureString"
  key_id = aws_kms_key.app.arn
  value  = aws_sns_topic.disponibilidad.arn
}

resource "aws_ssm_parameter" "notificaciones_queue_url" {
  name   = "/${local.name}/notificaciones-queue-url"
  type   = "SecureString"
  key_id = aws_kms_key.app.arn
  value  = aws_sqs_queue.notificaciones.url
}

resource "aws_ssm_parameter" "user_pool_id" {
  name   = "/${local.name}/user-pool-id"
  type   = "SecureString"
  key_id = aws_kms_key.app.arn
  value  = aws_cognito_user_pool.users.id
}
