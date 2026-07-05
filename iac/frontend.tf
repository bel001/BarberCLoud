resource "aws_s3_bucket" "frontend" {
  #checkov:skip=CKV_AWS_18:El acceso al frontend queda detras de CloudFront; logging dedicado de S3 se omite para mantener el despliegue academico simple.
  #checkov:skip=CKV_AWS_144:La replicacion cross-region se omite por costo y alcance academico del despliegue.
  #checkov:skip=CKV2_AWS_62:No se requieren notificaciones de eventos para un bucket estatico servido por CloudFront.

  bucket = local.frontend_bucket_name
}

resource "aws_s3_bucket_versioning" "frontend" {
  bucket = aws_s3_bucket.frontend.id

  versioning_configuration {
    status = "Enabled"
  }
}

resource "aws_s3_bucket_server_side_encryption_configuration" "frontend" {
  bucket = aws_s3_bucket.frontend.id

  rule {
    bucket_key_enabled = true

    apply_server_side_encryption_by_default {
      kms_master_key_id = aws_kms_key.app.arn
      sse_algorithm     = "aws:kms"
    }
  }
}

resource "aws_s3_bucket_lifecycle_configuration" "frontend" {
  bucket = aws_s3_bucket.frontend.id

  rule {
    id     = "expire-old-frontend-versions"
    status = "Enabled"

    filter {
      prefix = ""
    }

    abort_incomplete_multipart_upload {
      days_after_initiation = 7
    }

    noncurrent_version_expiration {
      noncurrent_days = 30
    }
  }
}

resource "aws_s3_bucket_public_access_block" "frontend" {
  bucket = aws_s3_bucket.frontend.id

  block_public_acls       = true
  block_public_policy     = true
  ignore_public_acls      = true
  restrict_public_buckets = true
}

resource "aws_s3_bucket_ownership_controls" "frontend" {
  bucket = aws_s3_bucket.frontend.id

  rule {
    object_ownership = "BucketOwnerEnforced"
  }
}

resource "aws_cloudfront_origin_access_control" "frontend" {
  name                              = "${local.name}-frontend-oac"
  description                       = "Acceso privado desde CloudFront hacia S3"
  origin_access_control_origin_type = "s3"
  signing_behavior                  = "always"
  signing_protocol                  = "sigv4"
}

resource "aws_cloudfront_response_headers_policy" "security" {
  name = "${local.name}-security-headers"

  security_headers_config {
    content_type_options {
      override = true
    }

    frame_options {
      frame_option = "DENY"
      override     = true
    }

    referrer_policy {
      referrer_policy = "strict-origin-when-cross-origin"
      override        = true
    }

    strict_transport_security {
      access_control_max_age_sec = 63072000
      include_subdomains         = true
      override                   = true
      preload                    = true
    }

    xss_protection {
      mode_block = true
      override   = true
      protection = true
    }
  }
}

resource "aws_cloudfront_distribution" "frontend" {
  #checkov:skip=CKV_AWS_68:WAF se omite por costo en despliegue academico/free tier.
  #checkov:skip=CKV_AWS_86:Access logging dedicado de CloudFront se omite por costo y alcance de demostracion.
  #checkov:skip=CKV_AWS_310:No se configura origin failover porque el frontend usa un unico bucket S3 estatico.
  #checkov:skip=CKV_AWS_374:La aplicacion se deja global para pruebas academicas sin restriccion geografica.
  #checkov:skip=CKV_AWS_174:Se configura TLSv1.2_2021 con certificado default; Checkov no reconoce este caso sin ACM propio.
  #checkov:skip=CKV2_AWS_42:Se usa el certificado default de CloudFront porque el proyecto no provisiona dominio propio.
  #checkov:skip=CKV2_AWS_47:WAF administrado para Log4j se omite junto con WAF por costo academico.

  enabled             = true
  default_root_object = "index.html"
  comment             = "${local.name} frontend"

  origin {
    domain_name              = aws_s3_bucket.frontend.bucket_regional_domain_name
    origin_access_control_id = aws_cloudfront_origin_access_control.frontend.id
    origin_id                = "s3-frontend"
  }

  default_cache_behavior {
    allowed_methods  = ["GET", "HEAD", "OPTIONS"]
    cached_methods   = ["GET", "HEAD"]
    target_origin_id = "s3-frontend"

    forwarded_values {
      query_string = false

      cookies {
        forward = "none"
      }
    }

    viewer_protocol_policy     = "redirect-to-https"
    min_ttl                    = 0
    default_ttl                = 3600
    max_ttl                    = 86400
    response_headers_policy_id = aws_cloudfront_response_headers_policy.security.id
  }

  custom_error_response {
    error_code         = 403
    response_code      = 200
    response_page_path = "/index.html"
  }

  custom_error_response {
    error_code         = 404
    response_code      = 200
    response_page_path = "/index.html"
  }

  restrictions {
    geo_restriction {
      restriction_type = "none"
    }
  }

  viewer_certificate {
    cloudfront_default_certificate = true
    minimum_protocol_version       = "TLSv1.2_2021"
  }
}

data "aws_iam_policy_document" "frontend_bucket" {
  statement {
    actions   = ["s3:GetObject"]
    resources = ["${aws_s3_bucket.frontend.arn}/*"]

    principals {
      type        = "Service"
      identifiers = ["cloudfront.amazonaws.com"]
    }

    condition {
      test     = "StringEquals"
      variable = "AWS:SourceArn"
      values   = [aws_cloudfront_distribution.frontend.arn]
    }
  }
}

resource "aws_s3_bucket_policy" "frontend" {
  bucket = aws_s3_bucket.frontend.id
  policy = data.aws_iam_policy_document.frontend_bucket.json
}

resource "aws_s3_object" "frontend_assets" {
  for_each = local.frontend_files

  bucket       = aws_s3_bucket.frontend.id
  key          = each.value
  source       = "${path.module}/../frontend/${each.value}"
  etag         = filemd5("${path.module}/../frontend/${each.value}")
  content_type = lookup(local.frontend_content_types, lower(regex("[^.]+$", each.value)), "application/octet-stream")
}

resource "aws_s3_object" "frontend_config" {
  bucket       = aws_s3_bucket.frontend.id
  key          = "assets/js/config.js"
  content_type = "application/javascript"

  content = <<-JS
  window.BARBERCLOUD_CONFIG = ${jsonencode({
  AUTH_MODE    = "cognito"
  API_BASE_URL = aws_apigatewayv2_api.reserva.api_endpoint
  API_BASE_URLS = {
    disponibilidad = aws_apigatewayv2_api.disponibilidad.api_endpoint
    reserva        = aws_apigatewayv2_api.reserva.api_endpoint
    cancelar       = aws_apigatewayv2_api.cancelar.api_endpoint
    barbero        = aws_apigatewayv2_api.barbero.api_endpoint
    secretaria     = aws_apigatewayv2_api.secretaria.api_endpoint
    administrador  = aws_apigatewayv2_api.administrador.api_endpoint
  }
  COGNITO_DOMAIN    = "https://${aws_cognito_user_pool_domain.main.domain}.auth.${var.aws_region}.amazoncognito.com"
  COGNITO_CLIENT_ID = aws_cognito_user_pool_client.web_client.id
  REDIRECT_URI      = "${local.frontend_https_url}/callback.html"
})};
  JS
}
