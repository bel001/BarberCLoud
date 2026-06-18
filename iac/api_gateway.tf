resource "aws_apigatewayv2_api" "public_api" {
  name          = "${local.name}-public-api"
  protocol_type = "HTTP"

  tags = local.common_tags
}

resource "aws_apigatewayv2_api" "private_api" {
  name          = "${local.name}-private-api"
  protocol_type = "HTTP"

  tags = local.common_tags
}

resource "aws_apigatewayv2_authorizer" "public_jwt" {
  api_id           = aws_apigatewayv2_api.public_api.id
  authorizer_type  = "JWT"
  identity_sources = ["$request.header.Authorization"]
  name             = "${local.name}-public-jwt"

  jwt_configuration {
    audience = [aws_cognito_user_pool_client.web_client.id]
    issuer   = "https://cognito-idp.${var.aws_region}.amazonaws.com/${aws_cognito_user_pool.users.id}"
  }
}

resource "aws_apigatewayv2_authorizer" "private_jwt" {
  api_id           = aws_apigatewayv2_api.private_api.id
  authorizer_type  = "JWT"
  identity_sources = ["$request.header.Authorization"]
  name             = "${local.name}-private-jwt"

  jwt_configuration {
    audience = [aws_cognito_user_pool_client.web_client.id]
    issuer   = "https://cognito-idp.${var.aws_region}.amazonaws.com/${aws_cognito_user_pool.users.id}"
  }
}

resource "aws_apigatewayv2_stage" "public_default" {
  api_id      = aws_apigatewayv2_api.public_api.id
  name        = "$default"
  auto_deploy = true
}

resource "aws_apigatewayv2_stage" "private_default" {
  api_id      = aws_apigatewayv2_api.private_api.id
  name        = "$default"
  auto_deploy = true
}
