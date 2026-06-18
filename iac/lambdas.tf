data "archive_file" "lambda_package" {
  type        = "zip"
  source_dir  = "../backend/src"
  output_path = "../backend/dist/lambda.zip"
}

resource "aws_lambda_function" "consultar_disponibilidad" {
  function_name = "${local.name}-consultar-disponibilidad"
  role          = aws_iam_role.lambda_role.arn
  handler       = "handlers/consultarDisponibilidad.handler"
  runtime       = "nodejs20.x"
  filename      = data.archive_file.lambda_package.output_path

  environment {
    variables = {
      TABLE_NAME = aws_dynamodb_table.barbercloud.name
      TOPIC_ARN  = aws_sns_topic.reservas.arn
    }
  }

  tags = local.common_tags
}

resource "aws_lambda_function" "nueva_reserva" {
  function_name = "${local.name}-nueva-reserva"
  role          = aws_iam_role.lambda_role.arn
  handler       = "handlers/nuevaReserva.handler"
  runtime       = "nodejs20.x"
  filename      = data.archive_file.lambda_package.output_path

  environment {
    variables = {
      TABLE_NAME = aws_dynamodb_table.barbercloud.name
      TOPIC_ARN  = aws_sns_topic.reservas.arn
    }
  }

  tags = local.common_tags
}

resource "aws_lambda_function" "cancelar_reserva" {
  function_name = "${local.name}-cancelar-reserva"
  role          = aws_iam_role.lambda_role.arn
  handler       = "handlers/cancelarReserva.handler"
  runtime       = "nodejs20.x"
  filename      = data.archive_file.lambda_package.output_path

  environment {
    variables = {
      TABLE_NAME = aws_dynamodb_table.barbercloud.name
      TOPIC_ARN  = aws_sns_topic.reservas.arn
    }
  }

  tags = local.common_tags
}

resource "aws_lambda_function" "gestion_clientes" {
  function_name = "${local.name}-gestion-clientes"
  role          = aws_iam_role.lambda_role.arn
  handler       = "handlers/gestionClientes.handler"
  runtime       = "nodejs20.x"
  filename      = data.archive_file.lambda_package.output_path

  environment {
    variables = {
      TABLE_NAME = aws_dynamodb_table.barbercloud.name
    }
  }

  tags = local.common_tags
}

resource "aws_lambda_function" "gestion_agenda_barbero" {
  function_name = "${local.name}-gestion-agenda-barbero"
  role          = aws_iam_role.lambda_role.arn
  handler       = "handlers/gestionAgendaBarbero.handler"
  runtime       = "nodejs20.x"
  filename      = data.archive_file.lambda_package.output_path

  environment {
    variables = {
      TABLE_NAME = aws_dynamodb_table.barbercloud.name
    }
  }

  tags = local.common_tags
}

resource "aws_lambda_function" "gestion_financiera" {
  function_name = "${local.name}-gestion-financiera"
  role          = aws_iam_role.lambda_role.arn
  handler       = "handlers/gestionFinanciera.handler"
  runtime       = "nodejs20.x"
  filename      = data.archive_file.lambda_package.output_path

  environment {
    variables = {
      TABLE_NAME = aws_dynamodb_table.barbercloud.name
    }
  }

  tags = local.common_tags
}
