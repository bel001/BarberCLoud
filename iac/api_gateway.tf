locals {
  cors_config = {
    allow_credentials = false
    allow_headers     = ["authorization", "content-type"]
    allow_methods     = ["GET", "POST", "OPTIONS"]
    allow_origins     = var.allowed_origins
    max_age           = 3600
  }

  api_access_log_format = jsonencode({
    requestId               = "$context.requestId"
    ip                      = "$context.identity.sourceIp"
    requestTime             = "$context.requestTime"
    httpMethod              = "$context.httpMethod"
    routeKey                = "$context.routeKey"
    status                  = "$context.status"
    protocol                = "$context.protocol"
    responseLength          = "$context.responseLength"
    integrationErrorMessage = "$context.integrationErrorMessage"
  })
}

resource "aws_apigatewayv2_api" "disponibilidad" {
  name          = "${local.name}-api-disponibilidad"
  protocol_type = "HTTP"
  cors_configuration {
    allow_headers = local.cors_config.allow_headers
    allow_methods = local.cors_config.allow_methods
    allow_origins = local.cors_config.allow_origins
    max_age       = local.cors_config.max_age
  }
}

resource "aws_apigatewayv2_api" "reserva" {
  name          = "${local.name}-api-reserva"
  protocol_type = "HTTP"
  cors_configuration {
    allow_headers = local.cors_config.allow_headers
    allow_methods = local.cors_config.allow_methods
    allow_origins = local.cors_config.allow_origins
    max_age       = local.cors_config.max_age
  }
}

resource "aws_apigatewayv2_api" "cancelar" {
  name          = "${local.name}-api-cancelar"
  protocol_type = "HTTP"
  cors_configuration {
    allow_headers = local.cors_config.allow_headers
    allow_methods = local.cors_config.allow_methods
    allow_origins = local.cors_config.allow_origins
    max_age       = local.cors_config.max_age
  }
}

resource "aws_apigatewayv2_api" "barbero" {
  name          = "${local.name}-api-barbero"
  protocol_type = "HTTP"
  cors_configuration {
    allow_headers = local.cors_config.allow_headers
    allow_methods = local.cors_config.allow_methods
    allow_origins = local.cors_config.allow_origins
    max_age       = local.cors_config.max_age
  }
}

resource "aws_apigatewayv2_api" "secretaria" {
  name          = "${local.name}-api-secretaria"
  protocol_type = "HTTP"
  cors_configuration {
    allow_headers = local.cors_config.allow_headers
    allow_methods = local.cors_config.allow_methods
    allow_origins = local.cors_config.allow_origins
    max_age       = local.cors_config.max_age
  }
}

resource "aws_apigatewayv2_api" "administrador" {
  name          = "${local.name}-api-administrador"
  protocol_type = "HTTP"
  cors_configuration {
    allow_headers = local.cors_config.allow_headers
    allow_methods = local.cors_config.allow_methods
    allow_origins = local.cors_config.allow_origins
    max_age       = local.cors_config.max_age
  }
}

resource "aws_apigatewayv2_authorizer" "reserva_jwt" {
  api_id           = aws_apigatewayv2_api.reserva.id
  authorizer_type  = "JWT"
  identity_sources = ["$request.header.Authorization"]
  name             = "${local.name}-reserva-jwt"

  jwt_configuration {
    audience = [aws_cognito_user_pool_client.web_client.id]
    issuer   = "https://cognito-idp.${var.aws_region}.amazonaws.com/${aws_cognito_user_pool.users.id}"
  }
}

resource "aws_apigatewayv2_authorizer" "cancelar_jwt" {
  api_id           = aws_apigatewayv2_api.cancelar.id
  authorizer_type  = "JWT"
  identity_sources = ["$request.header.Authorization"]
  name             = "${local.name}-cancelar-jwt"

  jwt_configuration {
    audience = [aws_cognito_user_pool_client.web_client.id]
    issuer   = "https://cognito-idp.${var.aws_region}.amazonaws.com/${aws_cognito_user_pool.users.id}"
  }
}

resource "aws_apigatewayv2_authorizer" "barbero_jwt" {
  api_id           = aws_apigatewayv2_api.barbero.id
  authorizer_type  = "JWT"
  identity_sources = ["$request.header.Authorization"]
  name             = "${local.name}-barbero-jwt"

  jwt_configuration {
    audience = [aws_cognito_user_pool_client.web_client.id]
    issuer   = "https://cognito-idp.${var.aws_region}.amazonaws.com/${aws_cognito_user_pool.users.id}"
  }
}

resource "aws_apigatewayv2_authorizer" "secretaria_jwt" {
  api_id           = aws_apigatewayv2_api.secretaria.id
  authorizer_type  = "JWT"
  identity_sources = ["$request.header.Authorization"]
  name             = "${local.name}-secretaria-jwt"

  jwt_configuration {
    audience = [aws_cognito_user_pool_client.web_client.id]
    issuer   = "https://cognito-idp.${var.aws_region}.amazonaws.com/${aws_cognito_user_pool.users.id}"
  }
}

resource "aws_apigatewayv2_authorizer" "administrador_jwt" {
  api_id           = aws_apigatewayv2_api.administrador.id
  authorizer_type  = "JWT"
  identity_sources = ["$request.header.Authorization"]
  name             = "${local.name}-administrador-jwt"

  jwt_configuration {
    audience = [aws_cognito_user_pool_client.web_client.id]
    issuer   = "https://cognito-idp.${var.aws_region}.amazonaws.com/${aws_cognito_user_pool.users.id}"
  }
}

locals {
  api_routes = {
    reserva_post = {
      api_id             = aws_apigatewayv2_api.reserva.id
      execution_arn      = aws_apigatewayv2_api.reserva.execution_arn
      route_key          = "POST /reservas"
      lambda_key         = "nueva_reserva"
      authorization_type = "JWT"
      authorizer_id      = aws_apigatewayv2_authorizer.reserva_jwt.id
    }
    cliente_reservas_get = {
      api_id             = aws_apigatewayv2_api.reserva.id
      execution_arn      = aws_apigatewayv2_api.reserva.execution_arn
      route_key          = "GET /cliente/reservas"
      lambda_key         = "mis_reservas"
      authorization_type = "JWT"
      authorizer_id      = aws_apigatewayv2_authorizer.reserva_jwt.id
    }
    cliente_recompensas_get = {
      api_id             = aws_apigatewayv2_api.reserva.id
      execution_arn      = aws_apigatewayv2_api.reserva.execution_arn
      route_key          = "GET /cliente/recompensas"
      lambda_key         = "gestion_recompensas"
      authorization_type = "JWT"
      authorizer_id      = aws_apigatewayv2_authorizer.reserva_jwt.id
    }
    cliente_recompensas_post = {
      api_id             = aws_apigatewayv2_api.reserva.id
      execution_arn      = aws_apigatewayv2_api.reserva.execution_arn
      route_key          = "POST /cliente/recompensas"
      lambda_key         = "gestion_recompensas"
      authorization_type = "JWT"
      authorizer_id      = aws_apigatewayv2_authorizer.reserva_jwt.id
    }
    cliente_cuenta_get = {
      api_id             = aws_apigatewayv2_api.reserva.id
      execution_arn      = aws_apigatewayv2_api.reserva.execution_arn
      route_key          = "GET /cliente/cuenta"
      lambda_key         = "gestion_cuenta"
      authorization_type = "JWT"
      authorizer_id      = aws_apigatewayv2_authorizer.reserva_jwt.id
    }
    cliente_cuenta_put = {
      api_id             = aws_apigatewayv2_api.reserva.id
      execution_arn      = aws_apigatewayv2_api.reserva.execution_arn
      route_key          = "PUT /cliente/cuenta"
      lambda_key         = "gestion_cuenta"
      authorization_type = "JWT"
      authorizer_id      = aws_apigatewayv2_authorizer.reserva_jwt.id
    }
    cancelar_post = {
      api_id             = aws_apigatewayv2_api.cancelar.id
      execution_arn      = aws_apigatewayv2_api.cancelar.execution_arn
      route_key          = "POST /reservas/{id}/cancelar"
      lambda_key         = "cancelar_reserva"
      authorization_type = "JWT"
      authorizer_id      = aws_apigatewayv2_authorizer.cancelar_jwt.id
    }
    reprogramar_post = {
      api_id             = aws_apigatewayv2_api.cancelar.id
      execution_arn      = aws_apigatewayv2_api.cancelar.execution_arn
      route_key          = "POST /reservas/{id}/reprogramar"
      lambda_key         = "reprogramar_reserva"
      authorization_type = "JWT"
      authorizer_id      = aws_apigatewayv2_authorizer.cancelar_jwt.id
    }
    barbero_agenda_get = {
      api_id             = aws_apigatewayv2_api.barbero.id
      execution_arn      = aws_apigatewayv2_api.barbero.execution_arn
      route_key          = "GET /barbero/agenda"
      lambda_key         = "gestion_agenda_barbero"
      authorization_type = "JWT"
      authorizer_id      = aws_apigatewayv2_authorizer.barbero_jwt.id
    }
    barbero_turno_put = {
      api_id             = aws_apigatewayv2_api.barbero.id
      execution_arn      = aws_apigatewayv2_api.barbero.execution_arn
      route_key          = "PUT /barbero/turno"
      lambda_key         = "gestion_agenda_barbero"
      authorization_type = "JWT"
      authorizer_id      = aws_apigatewayv2_authorizer.barbero_jwt.id
    }
    barbero_citas_estado_post = {
      api_id             = aws_apigatewayv2_api.barbero.id
      execution_arn      = aws_apigatewayv2_api.barbero.execution_arn
      route_key          = "POST /barbero/citas/{id}/estado"
      lambda_key         = "actualizar_estado_cita"
      authorization_type = "JWT"
      authorizer_id      = aws_apigatewayv2_authorizer.barbero_jwt.id
    }
    barbero_insumos_get = {
      api_id             = aws_apigatewayv2_api.barbero.id
      execution_arn      = aws_apigatewayv2_api.barbero.execution_arn
      route_key          = "GET /barbero/insumos"
      lambda_key         = "gestion_insumos"
      authorization_type = "JWT"
      authorizer_id      = aws_apigatewayv2_authorizer.barbero_jwt.id
    }
    barbero_insumos_post = {
      api_id             = aws_apigatewayv2_api.barbero.id
      execution_arn      = aws_apigatewayv2_api.barbero.execution_arn
      route_key          = "POST /barbero/insumos"
      lambda_key         = "gestion_insumos"
      authorization_type = "JWT"
      authorizer_id      = aws_apigatewayv2_authorizer.barbero_jwt.id
    }
    secretaria_reserva_post = {
      api_id             = aws_apigatewayv2_api.secretaria.id
      execution_arn      = aws_apigatewayv2_api.secretaria.execution_arn
      route_key          = "POST /secretaria/reservas-presenciales"
      lambda_key         = "gestion_clientes"
      authorization_type = "JWT"
      authorizer_id      = aws_apigatewayv2_authorizer.secretaria_jwt.id
    }
    secretaria_clientes_get = {
      api_id             = aws_apigatewayv2_api.secretaria.id
      execution_arn      = aws_apigatewayv2_api.secretaria.execution_arn
      route_key          = "GET /secretaria/clientes"
      lambda_key         = "gestion_clientes"
      authorization_type = "JWT"
      authorizer_id      = aws_apigatewayv2_authorizer.secretaria_jwt.id
    }
    secretaria_clientes_post = {
      api_id             = aws_apigatewayv2_api.secretaria.id
      execution_arn      = aws_apigatewayv2_api.secretaria.execution_arn
      route_key          = "POST /secretaria/clientes"
      lambda_key         = "gestion_clientes"
      authorization_type = "JWT"
      authorizer_id      = aws_apigatewayv2_authorizer.secretaria_jwt.id
    }
    secretaria_clientes_historial_get = {
      api_id             = aws_apigatewayv2_api.secretaria.id
      execution_arn      = aws_apigatewayv2_api.secretaria.execution_arn
      route_key          = "GET /secretaria/clientes/{id}/historial"
      lambda_key         = "gestion_clientes"
      authorization_type = "JWT"
      authorizer_id      = aws_apigatewayv2_authorizer.secretaria_jwt.id
    }
    secretaria_agenda_get = {
      api_id             = aws_apigatewayv2_api.secretaria.id
      execution_arn      = aws_apigatewayv2_api.secretaria.execution_arn
      route_key          = "GET /secretaria/agenda"
      lambda_key         = "gestion_agenda_barbero"
      authorization_type = "JWT"
      authorizer_id      = aws_apigatewayv2_authorizer.secretaria_jwt.id
    }
    secretaria_caja_abrir_post = {
      api_id             = aws_apigatewayv2_api.secretaria.id
      execution_arn      = aws_apigatewayv2_api.secretaria.execution_arn
      route_key          = "POST /secretaria/caja/abrir"
      lambda_key         = "gestion_caja"
      authorization_type = "JWT"
      authorizer_id      = aws_apigatewayv2_authorizer.secretaria_jwt.id
    }
    secretaria_caja_cerrar_post = {
      api_id             = aws_apigatewayv2_api.secretaria.id
      execution_arn      = aws_apigatewayv2_api.secretaria.execution_arn
      route_key          = "POST /secretaria/caja/cerrar"
      lambda_key         = "gestion_caja"
      authorization_type = "JWT"
      authorizer_id      = aws_apigatewayv2_authorizer.secretaria_jwt.id
    }
    secretaria_pos_get = {
      api_id             = aws_apigatewayv2_api.secretaria.id
      execution_arn      = aws_apigatewayv2_api.secretaria.execution_arn
      route_key          = "GET /secretaria/pos"
      lambda_key         = "gestion_pos"
      authorization_type = "JWT"
      authorizer_id      = aws_apigatewayv2_authorizer.secretaria_jwt.id
    }
    secretaria_pos_post = {
      api_id             = aws_apigatewayv2_api.secretaria.id
      execution_arn      = aws_apigatewayv2_api.secretaria.execution_arn
      route_key          = "POST /secretaria/pos"
      lambda_key         = "gestion_pos"
      authorization_type = "JWT"
      authorizer_id      = aws_apigatewayv2_authorizer.secretaria_jwt.id
    }
    secretaria_inventario_get = {
      api_id             = aws_apigatewayv2_api.secretaria.id
      execution_arn      = aws_apigatewayv2_api.secretaria.execution_arn
      route_key          = "GET /secretaria/inventario"
      lambda_key         = "gestion_inventario"
      authorization_type = "JWT"
      authorizer_id      = aws_apigatewayv2_authorizer.secretaria_jwt.id
    }
    secretaria_inventario_post = {
      api_id             = aws_apigatewayv2_api.secretaria.id
      execution_arn      = aws_apigatewayv2_api.secretaria.execution_arn
      route_key          = "POST /secretaria/inventario"
      lambda_key         = "gestion_inventario"
      authorization_type = "JWT"
      authorizer_id      = aws_apigatewayv2_authorizer.secretaria_jwt.id
    }
    admin_finanzas_get = {
      api_id             = aws_apigatewayv2_api.administrador.id
      execution_arn      = aws_apigatewayv2_api.administrador.execution_arn
      route_key          = "GET /admin/reporte-financiero"
      lambda_key         = "gestion_financiera"
      authorization_type = "JWT"
      authorizer_id      = aws_apigatewayv2_authorizer.administrador_jwt.id
    }
    admin_personal_get = {
      api_id             = aws_apigatewayv2_api.administrador.id
      execution_arn      = aws_apigatewayv2_api.administrador.execution_arn
      route_key          = "GET /admin/personal"
      lambda_key         = "gestion_personal"
      authorization_type = "JWT"
      authorizer_id      = aws_apigatewayv2_authorizer.administrador_jwt.id
    }
    admin_personal_post = {
      api_id             = aws_apigatewayv2_api.administrador.id
      execution_arn      = aws_apigatewayv2_api.administrador.execution_arn
      route_key          = "POST /admin/personal"
      lambda_key         = "gestion_personal"
      authorization_type = "JWT"
      authorizer_id      = aws_apigatewayv2_authorizer.administrador_jwt.id
    }
    admin_personal_baja_post = {
      api_id             = aws_apigatewayv2_api.administrador.id
      execution_arn      = aws_apigatewayv2_api.administrador.execution_arn
      route_key          = "POST /admin/personal/{id}/baja"
      lambda_key         = "gestion_personal"
      authorization_type = "JWT"
      authorizer_id      = aws_apigatewayv2_authorizer.administrador_jwt.id
    }
    admin_servicios_get = {
      api_id             = aws_apigatewayv2_api.administrador.id
      execution_arn      = aws_apigatewayv2_api.administrador.execution_arn
      route_key          = "GET /admin/servicios"
      lambda_key         = "gestion_negocio"
      authorization_type = "JWT"
      authorizer_id      = aws_apigatewayv2_authorizer.administrador_jwt.id
    }
    admin_servicios_post = {
      api_id             = aws_apigatewayv2_api.administrador.id
      execution_arn      = aws_apigatewayv2_api.administrador.execution_arn
      route_key          = "POST /admin/servicios"
      lambda_key         = "gestion_negocio"
      authorization_type = "JWT"
      authorizer_id      = aws_apigatewayv2_authorizer.administrador_jwt.id
    }
    admin_agenda_get = {
      api_id             = aws_apigatewayv2_api.administrador.id
      execution_arn      = aws_apigatewayv2_api.administrador.execution_arn
      route_key          = "GET /admin/agenda"
      lambda_key         = "gestion_agenda_barbero"
      authorization_type = "JWT"
      authorizer_id      = aws_apigatewayv2_authorizer.administrador_jwt.id
    }
    admin_insumos_get = {
      api_id             = aws_apigatewayv2_api.administrador.id
      execution_arn      = aws_apigatewayv2_api.administrador.execution_arn
      route_key          = "GET /admin/insumos"
      lambda_key         = "gestion_insumos"
      authorization_type = "JWT"
      authorizer_id      = aws_apigatewayv2_authorizer.administrador_jwt.id
    }
    admin_inventario_get = {
      api_id             = aws_apigatewayv2_api.administrador.id
      execution_arn      = aws_apigatewayv2_api.administrador.execution_arn
      route_key          = "GET /admin/inventario"
      lambda_key         = "gestion_inventario"
      authorization_type = "JWT"
      authorizer_id      = aws_apigatewayv2_authorizer.administrador_jwt.id
    }
    admin_pos_get = {
      api_id             = aws_apigatewayv2_api.administrador.id
      execution_arn      = aws_apigatewayv2_api.administrador.execution_arn
      route_key          = "GET /admin/pos"
      lambda_key         = "gestion_pos"
      authorization_type = "JWT"
      authorizer_id      = aws_apigatewayv2_authorizer.administrador_jwt.id
    }
    admin_dashboard_financiero_get = {
      api_id             = aws_apigatewayv2_api.administrador.id
      execution_arn      = aws_apigatewayv2_api.administrador.execution_arn
      route_key          = "GET /admin/dashboard-financiero"
      lambda_key         = "gestion_financiera"
      authorization_type = "JWT"
      authorizer_id      = aws_apigatewayv2_authorizer.administrador_jwt.id
    }
    admin_citas_estado_post = {
      api_id             = aws_apigatewayv2_api.administrador.id
      execution_arn      = aws_apigatewayv2_api.administrador.execution_arn
      route_key          = "POST /admin/citas/{id}/estado"
      lambda_key         = "actualizar_estado_cita"
      authorization_type = "JWT"
      authorizer_id      = aws_apigatewayv2_authorizer.administrador_jwt.id
    }
    admin_config_negocio_get = {
      api_id             = aws_apigatewayv2_api.administrador.id
      execution_arn      = aws_apigatewayv2_api.administrador.execution_arn
      route_key          = "GET /admin/config-negocio"
      lambda_key         = "gestion_config_negocio"
      authorization_type = "JWT"
      authorizer_id      = aws_apigatewayv2_authorizer.administrador_jwt.id
    }
    admin_config_negocio_put = {
      api_id             = aws_apigatewayv2_api.administrador.id
      execution_arn      = aws_apigatewayv2_api.administrador.execution_arn
      route_key          = "PUT /admin/config-negocio"
      lambda_key         = "gestion_config_negocio"
      authorization_type = "JWT"
      authorizer_id      = aws_apigatewayv2_authorizer.administrador_jwt.id
    }
    admin_actividad_get = {
      api_id             = aws_apigatewayv2_api.administrador.id
      execution_arn      = aws_apigatewayv2_api.administrador.execution_arn
      route_key          = "GET /admin/actividad"
      lambda_key         = "gestion_actividad"
      authorization_type = "JWT"
      authorizer_id      = aws_apigatewayv2_authorizer.administrador_jwt.id
    }
  }
}

resource "aws_apigatewayv2_integration" "routes" {
  for_each = local.api_routes

  api_id                 = each.value.api_id
  integration_type       = "AWS_PROXY"
  integration_uri        = aws_lambda_function.functions[each.value.lambda_key].invoke_arn
  payload_format_version = "2.0"
}

resource "aws_apigatewayv2_route" "routes" {
  for_each = local.api_routes

  api_id             = each.value.api_id
  route_key          = each.value.route_key
  target             = "integrations/${aws_apigatewayv2_integration.routes[each.key].id}"
  authorization_type = each.value.authorization_type
  authorizer_id      = each.value.authorizer_id
}

resource "aws_apigatewayv2_integration" "disponibilidad_public" {
  api_id                 = aws_apigatewayv2_api.disponibilidad.id
  integration_type       = "AWS_PROXY"
  integration_uri        = aws_lambda_function.functions["consultar_disponibilidad"].invoke_arn
  payload_format_version = "2.0"
}

resource "aws_apigatewayv2_route" "disponibilidad_public" {
  #checkov:skip=CKV_AWS_309:GET /disponibilidad es una consulta publica de solo lectura para clientes sin sesion.

  api_id             = aws_apigatewayv2_api.disponibilidad.id
  route_key          = "GET /disponibilidad"
  target             = "integrations/${aws_apigatewayv2_integration.disponibilidad_public.id}"
  authorization_type = "NONE"
}

resource "aws_cloudwatch_log_group" "api_gateway" {
  for_each = toset([
    "disponibilidad",
    "reserva",
    "cancelar",
    "barbero",
    "secretaria",
    "administrador"
  ])

  name              = "/aws/apigateway/${local.name}-${each.key}"
  kms_key_id        = aws_kms_key.app.arn
  retention_in_days = 365
}

resource "aws_apigatewayv2_stage" "disponibilidad" {
  api_id      = aws_apigatewayv2_api.disponibilidad.id
  name        = "$default"
  auto_deploy = true

  access_log_settings {
    destination_arn = aws_cloudwatch_log_group.api_gateway["disponibilidad"].arn
    format          = local.api_access_log_format
  }
}

resource "aws_apigatewayv2_stage" "reserva" {
  api_id      = aws_apigatewayv2_api.reserva.id
  name        = "$default"
  auto_deploy = true

  access_log_settings {
    destination_arn = aws_cloudwatch_log_group.api_gateway["reserva"].arn
    format          = local.api_access_log_format
  }
}

resource "aws_apigatewayv2_stage" "cancelar" {
  api_id      = aws_apigatewayv2_api.cancelar.id
  name        = "$default"
  auto_deploy = true

  access_log_settings {
    destination_arn = aws_cloudwatch_log_group.api_gateway["cancelar"].arn
    format          = local.api_access_log_format
  }
}

resource "aws_apigatewayv2_stage" "barbero" {
  api_id      = aws_apigatewayv2_api.barbero.id
  name        = "$default"
  auto_deploy = true

  access_log_settings {
    destination_arn = aws_cloudwatch_log_group.api_gateway["barbero"].arn
    format          = local.api_access_log_format
  }
}

resource "aws_apigatewayv2_stage" "secretaria" {
  api_id      = aws_apigatewayv2_api.secretaria.id
  name        = "$default"
  auto_deploy = true

  access_log_settings {
    destination_arn = aws_cloudwatch_log_group.api_gateway["secretaria"].arn
    format          = local.api_access_log_format
  }
}

resource "aws_apigatewayv2_stage" "administrador" {
  api_id      = aws_apigatewayv2_api.administrador.id
  name        = "$default"
  auto_deploy = true

  access_log_settings {
    destination_arn = aws_cloudwatch_log_group.api_gateway["administrador"].arn
    format          = local.api_access_log_format
  }
}

resource "aws_lambda_permission" "api_gateway" {
  for_each = local.api_routes

  statement_id  = "AllowExecutionFromAPIGateway-${each.key}"
  action        = "lambda:InvokeFunction"
  function_name = aws_lambda_function.functions[each.value.lambda_key].function_name
  principal     = "apigateway.amazonaws.com"
  source_arn    = "${each.value.execution_arn}/*/*"
}

resource "aws_lambda_permission" "api_gateway_disponibilidad_public" {
  statement_id  = "AllowExecutionFromAPIGateway-disponibilidad-public"
  action        = "lambda:InvokeFunction"
  function_name = aws_lambda_function.functions["consultar_disponibilidad"].function_name
  principal     = "apigateway.amazonaws.com"
  source_arn    = "${aws_apigatewayv2_api.disponibilidad.execution_arn}/*/*"
}
