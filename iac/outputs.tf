output "frontend_url" {
  value = "https://${aws_cloudfront_distribution.frontend.domain_name}"
}

output "api_disponibilidad_url" {
  value = aws_apigatewayv2_api.disponibilidad.api_endpoint
}

output "api_reserva_url" {
  value = aws_apigatewayv2_api.reserva.api_endpoint
}

output "api_cancelar_url" {
  value = aws_apigatewayv2_api.cancelar.api_endpoint
}

output "api_barbero_url" {
  value = aws_apigatewayv2_api.barbero.api_endpoint
}

output "api_secretaria_url" {
  value = aws_apigatewayv2_api.secretaria.api_endpoint
}

output "api_administrador_url" {
  value = aws_apigatewayv2_api.administrador.api_endpoint
}

output "user_pool_id" {
  value = aws_cognito_user_pool.users.id
}

output "user_pool_client_id" {
  value = aws_cognito_user_pool_client.web_client.id
}

output "cognito_domain" {
  value = "https://${aws_cognito_user_pool_domain.main.domain}.auth.${var.aws_region}.amazoncognito.com"
}

output "dynamodb_table" {
  value = aws_dynamodb_table.barbercloud.name
}

output "reservas_topic_arn" {
  value = aws_sns_topic.reservas.arn
}

output "disponibilidad_topic_arn" {
  value = aws_sns_topic.disponibilidad.arn
}

output "notificaciones_queue_url" {
  value = aws_sqs_queue.notificaciones.url
}

output "ses_identity" {
  value = aws_ses_email_identity.sender.email
}
