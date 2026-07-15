output "state_bucket" {
  value = aws_s3_bucket.terraform_state.id
}

output "lock_table" {
  value = aws_dynamodb_table.terraform_locks.name
}

output "github_deploy_role_arns" {
  value = {
    for environment, role in aws_iam_role.github_deploy : environment => role.arn
  }
}

output "cloudfront_origin_access_control_id" {
  value = aws_cloudfront_origin_access_control.frontend.id
}

output "backend_config" {
  value = {
    bucket         = aws_s3_bucket.terraform_state.id
    region         = var.aws_region
    dynamodb_table = aws_dynamodb_table.terraform_locks.name
    encrypt        = true
  }
}
