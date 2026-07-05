locals {
  cognito_domain_prefix = var.cognito_domain_prefix != "" ? var.cognito_domain_prefix : "${local.name}-${random_id.suffix.hex}"
  frontend_https_url    = "https://${aws_cloudfront_distribution.frontend.domain_name}"
  local_callback_url    = var.is_production ? [] : ["http://localhost:8080/callback.html"]
  local_logout_url      = var.is_production ? [] : ["http://localhost:8080/index.html"]
  all_callback_urls     = concat(local.local_callback_url, [local.frontend_https_url == "https://" ? "" : "${local.frontend_https_url}/callback.html"])
  all_logout_urls       = concat(local.local_logout_url, [local.frontend_https_url == "https://" ? "" : "${local.frontend_https_url}/index.html"])
}

resource "aws_cognito_user_pool" "users" {
  name = "${local.name}-users"

  username_attributes      = ["email"]
  auto_verified_attributes = ["email"]

  password_policy {
    minimum_length    = 8
    require_numbers   = true
    require_symbols   = false
    require_lowercase = true
    require_uppercase = true
  }

  mfa_configuration = "OFF"

  lambda_config {
    post_confirmation = aws_lambda_function.post_confirm_cliente.arn
  }
}

resource "aws_cognito_user_pool_client" "web_client" {
  name         = "${local.name}-web-client"
  user_pool_id = aws_cognito_user_pool.users.id

  generate_secret                      = false
  allowed_oauth_flows_user_pool_client = true
  allowed_oauth_flows                  = ["code"]
  allowed_oauth_scopes                 = ["email", "openid", "profile"]
  callback_urls                        = local.all_callback_urls
  logout_urls                          = local.all_logout_urls
  supported_identity_providers         = ["COGNITO"]
  explicit_auth_flows                  = ["ALLOW_USER_SRP_AUTH", "ALLOW_REFRESH_TOKEN_AUTH", "ALLOW_USER_PASSWORD_AUTH"]

  access_token_validity  = 60
  id_token_validity      = 60
  refresh_token_validity = 1

  token_validity_units {
    access_token  = "minutes"
    id_token      = "minutes"
    refresh_token = "days"
  }
}

resource "aws_cognito_user_pool_domain" "main" {
  domain       = local.cognito_domain_prefix
  user_pool_id = aws_cognito_user_pool.users.id
}

resource "aws_cognito_user_group" "cliente" {
  name         = "CLIENTE"
  user_pool_id = aws_cognito_user_pool.users.id
}

resource "aws_cognito_user_group" "barbero" {
  name         = "BARBERO"
  user_pool_id = aws_cognito_user_pool.users.id
}

resource "aws_cognito_user_group" "secretaria" {
  name         = "SECRETARIA"
  user_pool_id = aws_cognito_user_pool.users.id
}

resource "aws_cognito_user_group" "admin" {
  name         = "ADMIN"
  user_pool_id = aws_cognito_user_pool.users.id
}

resource "aws_lambda_permission" "cognito_post_confirm" {
  statement_id  = "AllowCognitoPostConfirm"
  action        = "lambda:InvokeFunction"
  function_name = aws_lambda_function.post_confirm_cliente.function_name
  principal     = "cognito-idp.amazonaws.com"
  source_arn    = aws_cognito_user_pool.users.arn
}
