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
  frontend_files = setsubtract(fileset("${path.module}/../frontend", "**"), ["assets/js/config.js"])
}

resource "aws_s3_bucket" "frontend" {
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
  bucket = aws_s3_bucket.frontend.id
  rule {
    apply_server_side_encryption_by_default {
      sse_algorithm = "AES256"
    }
  }
}

resource "aws_s3_bucket_versioning" "frontend" {
  bucket = aws_s3_bucket.frontend.id
  versioning_configuration {
    status = "Enabled"
  }
}

resource "aws_cloudfront_origin_access_control" "frontend" {
  name                              = "${local.prefix}-frontend-oac"
  description                       = "OAC para frontend privado"
  origin_access_control_origin_type = "s3"
  signing_behavior                  = "always"
  signing_protocol                  = "sigv4"
}

resource "aws_cloudfront_distribution" "frontend" {
  enabled             = true
  default_root_object = "index.html"
  price_class         = "PriceClass_100"

  origin {
    domain_name              = aws_s3_bucket.frontend.bucket_regional_domain_name
    origin_id                = "frontend-s3"
    origin_access_control_id = aws_cloudfront_origin_access_control.frontend.id
  }

  default_cache_behavior {
    allowed_methods        = ["GET", "HEAD", "OPTIONS"]
    cached_methods         = ["GET", "HEAD"]
    target_origin_id       = "frontend-s3"
    viewer_protocol_policy = "redirect-to-https"
    compress               = true

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

  bucket       = aws_s3_bucket.frontend.id
  key          = each.value
  source       = "${path.module}/../frontend/${each.value}"
  etag         = filemd5("${path.module}/../frontend/${each.value}")
  content_type = lookup(local.frontend_content_types, lower(element(reverse(split(".", each.value)), 0)), "application/octet-stream")
}

resource "aws_s3_object" "runtime_config" {
  bucket       = aws_s3_bucket.frontend.id
  key          = "assets/js/config.js"
  content_type = "application/javascript"
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
