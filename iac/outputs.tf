output "dynamodb_table" {
  value = aws_dynamodb_table.main.name
}

output "user_pool_id" {
  value = aws_cognito_user_pool.main.id
}

output "user_pool_client_id" {
  value = aws_cognito_user_pool_client.frontend.id
}

output "cognito_domain" {
  value = "https://${aws_cognito_user_pool_domain.main.domain}.auth.${var.aws_region}.amazoncognito.com"
}

output "frontend_bucket" {
  value = aws_s3_bucket.frontend.id
}

output "frontend_url" {
  value = "https://${aws_cloudfront_distribution.frontend.domain_name}"
}

output "cloudfront_distribution_id" {
  value = aws_cloudfront_distribution.frontend.id
}

output "api_urls" {
  value = {
    for key, api in aws_apigatewayv2_api.apis : key => api.api_endpoint
  }
}

output "route_count" {
  value = length(local.api_routes)
}

output "ses_identity" {
  value = aws_ses_email_identity.sender.email
}
