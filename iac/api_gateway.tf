locals {
  apis = {
    availability = {
      name   = "availability"
      public = true
      routes = {
        "GET /api/public/services"     = "catalogo_publico"
        "GET /api/public/barbers"      = "catalogo_publico"
        "GET /api/public/business"     = "catalogo_publico"
        "GET /api/public/availability" = "consultar_disponibilidad"
      }
    }
    reservation = {
      name   = "reservation"
      public = false
      routes = {
        "GET /api/client/me"                           = "cuenta_cliente"
        "PUT /api/client/me"                           = "cuenta_cliente"
        "GET /api/client/appointments"                 = "reservas_cliente"
        "POST /api/client/appointments"                = "reservas_cliente"
        "PUT /api/client/appointments/{id}/reschedule" = "reservas_cliente"
      }
    }
    cancellation = {
      name   = "cancellation"
      public = false
      routes = {
        "DELETE /api/client/appointments/{id}" = "cancelar_reserva"
      }
    }
    barber = {
      name   = "barber"
      public = false
      routes = {
        "GET /api/barber/agenda"                     = "agenda_barbero"
        "PATCH /api/barber/appointments/{id}/status" = "agenda_barbero"
        "GET /api/barber/supplies"                   = "insumos_barbero"
        "POST /api/barber/supplies/usage"            = "insumos_barbero"
      }
    }
    secretary = {
      name   = "secretary"
      public = false
      routes = {
        "GET /api/secretary/clients"          = "clientes"
        "POST /api/secretary/clients"         = "clientes"
        "GET /api/secretary/agenda"           = "agenda_global"
        "POST /api/secretary/appointments"    = "agenda_global"
        "GET /api/secretary/inventory"        = "inventario"
        "POST /api/secretary/inventory"       = "inventario"
        "PATCH /api/secretary/inventory/{id}" = "inventario"
        "GET /api/secretary/pos/sales"        = "pos"
        "POST /api/secretary/pos/sales"       = "pos"
        "GET /api/secretary/cash/current"     = "pos"
        "POST /api/secretary/cash/open"       = "pos"
        "POST /api/secretary/cash/close"      = "pos"
      }
    }
    administrator = {
      name   = "administrator"
      public = false
      routes = {
        "GET /api/admin/dashboard"       = "dashboard"
        "GET /api/admin/staff"           = "personal"
        "POST /api/admin/staff"          = "personal"
        "PATCH /api/admin/staff/{id}"    = "personal"
        "GET /api/admin/services"        = "negocio"
        "POST /api/admin/services"       = "negocio"
        "PATCH /api/admin/services/{id}" = "negocio"
        "GET /api/admin/business"        = "negocio"
        "PATCH /api/admin/business"      = "negocio"
        "GET /api/admin/finance"         = "financiera"
        "GET /api/admin/audit"           = "auditoria"

        # Funciones operativas que el diagrama también concede al administrador.
        "GET /api/admin/clients"          = "clientes"
        "POST /api/admin/clients"         = "clientes"
        "GET /api/admin/agenda"           = "agenda_global"
        "POST /api/admin/appointments"    = "agenda_global"
        "GET /api/admin/inventory"        = "inventario"
        "POST /api/admin/inventory"       = "inventario"
        "PATCH /api/admin/inventory/{id}" = "inventario"
        "GET /api/admin/pos/sales"        = "pos"
        "POST /api/admin/pos/sales"       = "pos"
        "GET /api/admin/cash/current"     = "pos"
        "POST /api/admin/cash/open"       = "pos"
        "POST /api/admin/cash/close"      = "pos"
      }
    }
  }

  api_routes = merge([
    for api_key, api in local.apis : {
      for route_key, lambda_key in api.routes : "${api_key}|${route_key}" => {
        api_key    = api_key
        route_key  = route_key
        lambda_key = lambda_key
        public     = api.public
      }
    }
  ]...)
}

resource "aws_apigatewayv2_api" "apis" {
  for_each      = local.apis
  name          = "${local.prefix}-${each.value.name}"
  protocol_type = "HTTP"

  cors_configuration {
    allow_headers = ["authorization", "content-type"]
    allow_methods = ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"]
    allow_origins = var.allowed_origins
    max_age       = 3600
  }
}

resource "aws_apigatewayv2_authorizer" "jwt" {
  for_each = {
    for key, api in local.apis : key => api if !api.public
  }

  api_id           = aws_apigatewayv2_api.apis[each.key].id
  authorizer_type  = "JWT"
  identity_sources = ["$request.header.Authorization"]
  name             = "${local.prefix}-${each.key}-jwt"

  jwt_configuration {
    audience = [aws_cognito_user_pool_client.frontend.id]
    issuer   = "https://${aws_cognito_user_pool.main.endpoint}"
  }
}

resource "aws_apigatewayv2_integration" "routes" {
  for_each = local.api_routes

  api_id                 = aws_apigatewayv2_api.apis[each.value.api_key].id
  integration_type       = "AWS_PROXY"
  integration_uri        = aws_lambda_function.functions[each.value.lambda_key].invoke_arn
  payload_format_version = "2.0"
}

resource "aws_apigatewayv2_route" "private_routes" {
  for_each = {
    for key, route in local.api_routes :
    key => route if !route.public
  }

  api_id    = aws_apigatewayv2_api.apis[each.value.api_key].id
  route_key = each.value.route_key
  target    = "integrations/${aws_apigatewayv2_integration.routes[each.key].id}"

  authorization_type = "JWT"
  authorizer_id      = aws_apigatewayv2_authorizer.jwt[each.value.api_key].id
}

resource "aws_apigatewayv2_route" "public_routes" {
  # checkov:skip=CKV_AWS_309:El catálogo, los barberos, el negocio y la disponibilidad son consultas públicas de solo lectura.
  for_each = {
    for key, route in local.api_routes :
    key => route if route.public
  }

  api_id             = aws_apigatewayv2_api.apis[each.value.api_key].id
  route_key          = each.value.route_key
  target             = "integrations/${aws_apigatewayv2_integration.routes[each.key].id}"
  authorization_type = "NONE"
}

resource "aws_cloudwatch_log_group" "api_gateway" {
  for_each          = local.apis
  name              = "/aws/apigateway/${local.prefix}-${each.key}"
  retention_in_days = 365
  kms_key_id        = aws_kms_key.cloudwatch_logs.arn
}

resource "aws_apigatewayv2_stage" "default" {
  for_each = local.apis

  api_id      = aws_apigatewayv2_api.apis[each.key].id
  name        = "$default"
  auto_deploy = true

  access_log_settings {
    destination_arn = aws_cloudwatch_log_group.api_gateway[each.key].arn
    format = jsonencode({
      requestId = "$context.requestId"
      routeKey  = "$context.routeKey"
      status    = "$context.status"
      error     = "$context.integrationErrorMessage"
    })
  }

  default_route_settings {
    throttling_burst_limit = 50
    throttling_rate_limit  = 25
  }
}

resource "aws_lambda_permission" "api_gateway" {
  for_each = local.api_routes

  statement_id  = "AllowApiGateway-${substr(sha1(each.key), 0, 12)}"
  action        = "lambda:InvokeFunction"
  function_name = aws_lambda_function.functions[each.value.lambda_key].function_name
  principal     = "apigateway.amazonaws.com"
  source_arn    = "${aws_apigatewayv2_api.apis[each.value.api_key].execution_arn}/*/*"
}
