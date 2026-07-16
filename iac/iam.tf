locals {
  lambda_assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [{
      Effect    = "Allow"
      Principal = { Service = "lambda.amazonaws.com" }
      Action    = "sts:AssumeRole"
    }]
  })

  lambda_without_dynamodb = toset([
    "notificar_reserva",
    "notificar_cancelacion"
  ])

  lambda_dynamodb_writers = toset([
    "cuenta_cliente",
    "reservas_cliente",
    "cancelar_reserva",
    "agenda_barbero",
    "insumos_barbero",
    "clientes",
    "agenda_global",
    "pos",
    "inventario",
    "personal",
    "negocio"
  ])

  lambda_cognito_actions = {
    cuenta_cliente = ["cognito-idp:AdminUpdateUserAttributes"]
    clientes = [
      "cognito-idp:AdminCreateUser",
      "cognito-idp:AdminAddUserToGroup"
    ]
    personal = [
      "cognito-idp:AdminCreateUser",
      "cognito-idp:AdminUpdateUserAttributes",
      "cognito-idp:AdminAddUserToGroup",
      "cognito-idp:AdminRemoveUserFromGroup",
      "cognito-idp:AdminDisableUser",
      "cognito-idp:AdminEnableUser"
    ]
  }

  notification_functions = toset([
    "notificar_reserva",
    "notificar_cancelacion"
  ])
}

resource "aws_iam_role" "lambda" {
  for_each = local.lambda_handlers

  name               = "${local.prefix}-${replace(each.key, "_", "-")}-role"
  assume_role_policy = local.lambda_assume_role_policy
}

resource "aws_iam_role_policy" "lambda" {
  for_each = local.lambda_handlers

  role = aws_iam_role.lambda[each.key].id
  policy = jsonencode({
    Version = "2012-10-17"
    Statement = concat(
      [
        {
          Sid    = "WriteOwnLogs"
          Effect = "Allow"
          Action = [
            "logs:CreateLogStream",
            "logs:PutLogEvents"
          ]
          Resource = "${aws_cloudwatch_log_group.lambda[each.key].arn}:*"
        },
        {
          Sid      = "PublishOwnDeadLetters"
          Effect   = "Allow"
          Action   = ["sqs:SendMessage"]
          Resource = aws_sqs_queue.lambda_dlq.arn
        },
        {
          Sid    = "UseApplicationKey"
          Effect = "Allow"
          Action = [
            "kms:Decrypt",
            "kms:DescribeKey",
            "kms:GenerateDataKey*"
          ]
          Resource = aws_kms_key.application.arn
        },
        {
          Sid    = "PublishTraces"
          Effect = "Allow"
          Action = [
            "xray:PutTraceSegments",
            "xray:PutTelemetryRecords"
          ]
          Resource = "*"
        }
      ],
      contains(local.lambda_without_dynamodb, each.key) ? [] : [{
        Sid    = "UseApplicationTable"
        Effect = "Allow"
        Action = contains(local.lambda_dynamodb_writers, each.key) ? [
          "dynamodb:GetItem",
          "dynamodb:PutItem",
          "dynamodb:UpdateItem",
          "dynamodb:DeleteItem",
          "dynamodb:Scan",
          "dynamodb:Query",
          "dynamodb:BatchWriteItem",
          "dynamodb:TransactWriteItems"
          ] : [
          "dynamodb:GetItem",
          "dynamodb:Scan",
          "dynamodb:Query"
        ]
        Resource = [
          aws_dynamodb_table.main.arn,
          "${aws_dynamodb_table.main.arn}/index/*"
        ]
      }],
      length(lookup(local.lambda_cognito_actions, each.key, [])) == 0 ? [] : [{
        Sid      = "ManageRequiredCognitoUsers"
        Effect   = "Allow"
        Action   = local.lambda_cognito_actions[each.key]
        Resource = aws_cognito_user_pool.main.arn
      }],
      contains(local.notification_functions, each.key) ? [{
        Sid    = "SendNotifications"
        Effect = "Allow"
        Action = [
          "ses:SendEmail",
          "ses:SendRawEmail"
        ]
        Resource = "arn:aws:ses:${var.aws_region}:${data.aws_caller_identity.current.account_id}:identity/${var.ses_sender_email}"
      }] : [],
      each.key == "notificar_cancelacion" ? [{
        Sid    = "ConsumeRetryQueue"
        Effect = "Allow"
        Action = [
          "sqs:ReceiveMessage",
          "sqs:DeleteMessage",
          "sqs:GetQueueAttributes"
        ]
        Resource = aws_sqs_queue.notification_retry.arn
      }] : []
    )
  })
}

resource "aws_iam_role" "post_confirm_client" {
  name               = "${local.prefix}-post-confirm-client-role"
  assume_role_policy = local.lambda_assume_role_policy
}

resource "aws_iam_role_policy" "post_confirm_client" {
  role = aws_iam_role.post_confirm_client.id
  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Sid    = "WriteOwnLogs"
        Effect = "Allow"
        Action = [
          "logs:CreateLogStream",
          "logs:PutLogEvents"
        ]
        Resource = "${aws_cloudwatch_log_group.post_confirm_client.arn}:*"
      },
      {
        Sid      = "PublishOwnDeadLetters"
        Effect   = "Allow"
        Action   = ["sqs:SendMessage"]
        Resource = aws_sqs_queue.lambda_dlq.arn
      },
      {
        Sid    = "CreateClientProfile"
        Effect = "Allow"
        Action = [
          "dynamodb:GetItem",
          "dynamodb:PutItem"
        ]
        Resource = aws_dynamodb_table.main.arn
      },
      {
        Sid      = "AssignClientGroup"
        Effect   = "Allow"
        Action   = ["cognito-idp:AdminAddUserToGroup"]
        Resource = "arn:${data.aws_partition.current.partition}:cognito-idp:${var.aws_region}:${data.aws_caller_identity.current.account_id}:userpool/*"
      },
      {
        Sid    = "UseApplicationKey"
        Effect = "Allow"
        Action = [
          "kms:Decrypt",
          "kms:DescribeKey",
          "kms:GenerateDataKey*"
        ]
        Resource = aws_kms_key.application.arn
      },
      {
        Sid    = "PublishTraces"
        Effect = "Allow"
        Action = [
          "xray:PutTraceSegments",
          "xray:PutTelemetryRecords"
        ]
        Resource = "*"
      }
    ]
  })
}
