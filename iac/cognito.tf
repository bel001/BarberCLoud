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

  tags = local.common_tags
}

resource "aws_cognito_user_pool_client" "web_client" {
  name         = "${local.name}-web-client"
  user_pool_id = aws_cognito_user_pool.users.id

  generate_secret = false

  allowed_oauth_flows_user_pool_client = true
  allowed_oauth_flows                  = ["code"]
  allowed_oauth_scopes                 = ["email", "openid", "profile"]

  callback_urls = ["http://localhost:8080/cliente.html"]
  logout_urls   = ["http://localhost:8080/index.html"]

  supported_identity_providers = ["COGNITO"]
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
