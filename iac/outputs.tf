output "public_api_id" {
  value = aws_apigatewayv2_api.public_api.id
}

output "private_api_id" {
  value = aws_apigatewayv2_api.private_api.id
}

output "user_pool_id" {
  value = aws_cognito_user_pool.users.id
}

output "user_pool_client_id" {
  value = aws_cognito_user_pool_client.web_client.id
}

output "dynamodb_table" {
  value = aws_dynamodb_table.barbercloud.name
}
