resource "aws_cognito_user_pool" "main" {
  name                     = "${local.prefix}-users"
  username_attributes      = ["email"]
  auto_verified_attributes = ["email"]
  mfa_configuration        = "OPTIONAL"

  software_token_mfa_configuration {
    enabled = true
  }

  password_policy {
    minimum_length                   = 8
    require_lowercase                = true
    require_numbers                  = true
    require_symbols                  = true
    require_uppercase                = true
    temporary_password_validity_days = 7
  }

  schema {
    name                = "name"
    attribute_data_type = "String"
    mutable             = true
    required            = true
  }

  schema {
    name                = "phone_number"
    attribute_data_type = "String"
    mutable             = true
    required            = false
  }

  lambda_config {
    post_confirmation = aws_lambda_function.post_confirm_client.arn
  }
}

resource "aws_lambda_permission" "cognito_post_confirmation" {
  statement_id  = "AllowCognitoPostConfirmation"
  action        = "lambda:InvokeFunction"
  function_name = aws_lambda_function.post_confirm_client.function_name
  principal     = "cognito-idp.amazonaws.com"
  source_arn    = aws_cognito_user_pool.main.arn
}

resource "aws_cognito_user_pool_client" "frontend" {
  name                                 = "${local.prefix}-frontend"
  user_pool_id                         = aws_cognito_user_pool.main.id
  generate_secret                      = false
  allowed_oauth_flows_user_pool_client = true
  allowed_oauth_flows                  = ["code"]
  allowed_oauth_scopes                 = ["openid", "email", "profile"]
  callback_urls = distinct(concat(
    var.frontend_callback_urls,
    ["https://${aws_cloudfront_distribution.frontend.domain_name}/callback.html"]
  ))
  logout_urls = distinct(concat(
    var.frontend_logout_urls,
    ["https://${aws_cloudfront_distribution.frontend.domain_name}/index.html"]
  ))
  supported_identity_providers  = ["COGNITO"]
  prevent_user_existence_errors = "ENABLED"
}

resource "aws_cognito_user_pool_domain" "main" {
  domain       = "${local.prefix}-${data.aws_caller_identity.current.account_id}"
  user_pool_id = aws_cognito_user_pool.main.id
}

resource "aws_cognito_user_group" "groups" {
  for_each = toset(["CLIENTE", "BARBERO", "SECRETARIA", "ADMIN"])

  name         = each.value
  user_pool_id = aws_cognito_user_pool.main.id
  precedence   = each.value == "ADMIN" ? 1 : each.value == "SECRETARIA" ? 2 : each.value == "BARBERO" ? 3 : 4
}

data "aws_caller_identity" "current" {}
