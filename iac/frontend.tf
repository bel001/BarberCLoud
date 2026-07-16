locals {
  frontend_content_types = {
    css  = "text/css"
    html = "text/html"
    js   = "application/javascript"
    json = "application/json"
    png  = "image/png"
    svg  = "image/svg+xml"
    webp = "image/webp"
    jpg  = "image/jpeg"
    jpeg = "image/jpeg"
    ico  = "image/x-icon"
  }
  frontend_files = setsubtract(
    fileset("${path.module}/../frontend", "**"),
    [
      ".dockerignore",
      "Dockerfile",
      "nginx.conf",
      "assets/js/config.js",
    ]
  )
}

resource "aws_s3_bucket" "frontend" {
  #checkov:skip=CKV_AWS_18:El bucket es privado y solo CloudFront OAC puede leerlo; no se mantiene un segundo bucket de logs en este entorno de bajo costo.
  #checkov:skip=CKV_AWS_144:El frontend se reconstruye desde Git y CloudFront; la replicación entre regiones no forma parte del alcance de recuperación de este entorno.
  #checkov:skip=CKV2_AWS_62:Los objetos estáticos no tienen consumidores de eventos S3 dentro de la lógica de negocio.
  bucket_prefix = "${local.prefix}-frontend-"
}

resource "aws_s3_bucket_public_access_block" "frontend" {
  bucket = aws_s3_bucket.frontend.id

  block_public_acls       = true
  block_public_policy     = true
  ignore_public_acls      = true
  restrict_public_buckets = true
}

resource "aws_s3_bucket_server_side_encryption_configuration" "frontend" {
  #checkov:skip=CKV_AWS_145:CloudFront OAC no puede leer objetos cifrados con alias/aws/s3 en este frontend; el bucket mantiene cifrado SSE-S3 y acceso privado solo por CloudFront.
  bucket = aws_s3_bucket.frontend.id
  rule {
    apply_server_side_encryption_by_default {
      sse_algorithm = "AES256"
    }
  }
}

resource "aws_s3_bucket_lifecycle_configuration" "frontend" {
  bucket = aws_s3_bucket.frontend.id

  rule {
    id     = "frontend-maintenance"
    status = "Enabled"

    filter {}

    abort_incomplete_multipart_upload {
      days_after_initiation = 7
    }

    noncurrent_version_expiration {
      noncurrent_days = 30
    }
  }

  depends_on = [aws_s3_bucket_versioning.frontend]
}

resource "aws_s3_bucket_versioning" "frontend" {
  bucket = aws_s3_bucket.frontend.id
  versioning_configuration {
    status = "Enabled"
  }
}

data "aws_cloudfront_response_headers_policy" "frontend_security" {
  name = "Managed-SecurityHeadersPolicy"
}

resource "aws_cloudfront_distribution" "frontend" {
  #checkov:skip=CKV_AWS_68:WAF se habilitará al publicar un dominio de producción; este entorno académico de bajo costo solo sirve contenido estático privado mediante OAC.
  #checkov:skip=CKV_AWS_86:El registro de acceso de CloudFront se incorporará con un bucket central de auditoría en producción; CloudWatch y las métricas nativas cubren este entorno.
  #checkov:skip=CKV_AWS_374:La barbería no restringe clientes por país; el acceso mundial es un requisito funcional intencional.
  #checkov:skip=CKV_AWS_310:El frontend se reconstruye desde Git y usa un único origen S3; un segundo origen regional queda fuera del alcance y costo actual.
  #checkov:skip=CKV_AWS_174:Se utiliza el certificado y dominio predeterminados de CloudFront; la política TLS personalizada se configurará junto con un dominio y certificado ACM propios.
  #checkov:skip=CKV2_AWS_42:Se usa el dominio HTTPS asignado por CloudFront; no existe todavía un dominio propio ni un certificado ACM.
  #checkov:skip=CKV2_AWS_47:La distribución entrega únicamente HTML, CSS, JavaScript e imágenes; no ejecuta Log4j y no se incorpora WAF en este entorno de bajo costo.
  enabled             = true
  default_root_object = "index.html"
  price_class         = "PriceClass_100"

  origin {
    domain_name              = aws_s3_bucket.frontend.bucket_regional_domain_name
    origin_id                = "frontend-s3"
    origin_access_control_id = var.cloudfront_origin_access_control_id
  }

  default_cache_behavior {
    allowed_methods            = ["GET", "HEAD", "OPTIONS"]
    cached_methods             = ["GET", "HEAD"]
    target_origin_id           = "frontend-s3"
    viewer_protocol_policy     = "redirect-to-https"
    compress                   = true
    response_headers_policy_id = data.aws_cloudfront_response_headers_policy.frontend_security.id

    forwarded_values {
      query_string = false
      cookies {
        forward = "none"
      }
    }
  }

  restrictions {
    geo_restriction {
      restriction_type = "none"
    }
  }

  viewer_certificate {
    cloudfront_default_certificate = true
  }
}

resource "aws_s3_bucket_policy" "frontend" {
  bucket = aws_s3_bucket.frontend.id
  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [{
      Sid       = "AllowCloudFrontRead"
      Effect    = "Allow"
      Principal = { Service = "cloudfront.amazonaws.com" }
      Action    = "s3:GetObject"
      Resource  = "${aws_s3_bucket.frontend.arn}/*"
      Condition = {
        StringEquals = {
          "AWS:SourceArn" = aws_cloudfront_distribution.frontend.arn
        }
      }
    }]
  })
}

resource "aws_s3_object" "frontend_files" {
  for_each = local.frontend_files

  bucket                 = aws_s3_bucket.frontend.id
  key                    = each.value
  source                 = "${path.module}/../frontend/${each.value}"
  etag                   = filemd5("${path.module}/../frontend/${each.value}")
  content_type           = lookup(local.frontend_content_types, lower(element(reverse(split(".", each.value)), 0)), "application/octet-stream")
  server_side_encryption = "AES256"
}

resource "aws_s3_object" "runtime_config" {
  bucket                 = aws_s3_bucket.frontend.id
  key                    = "assets/js/config.js"
  content_type           = "application/javascript"
  server_side_encryption = "AES256"
  content = <<-JS
    export const runtimeConfig = ${jsonencode({
  mode = "aws"
  api = {
    public       = aws_apigatewayv2_api.apis["availability"].api_endpoint
    reservation  = aws_apigatewayv2_api.apis["reservation"].api_endpoint
    cancellation = aws_apigatewayv2_api.apis["cancellation"].api_endpoint
    barber       = aws_apigatewayv2_api.apis["barber"].api_endpoint
    secretary    = aws_apigatewayv2_api.apis["secretary"].api_endpoint
    admin        = aws_apigatewayv2_api.apis["administrator"].api_endpoint
  }
  cognito = {
    domain      = "https://${aws_cognito_user_pool_domain.main.domain}.auth.${var.aws_region}.amazoncognito.com"
    clientId    = aws_cognito_user_pool_client.frontend.id
    redirectUri = "https://${aws_cloudfront_distribution.frontend.domain_name}/callback.html"
    logoutUri   = "https://${aws_cloudfront_distribution.frontend.domain_name}/index.html"
  }
})};
  JS
}
