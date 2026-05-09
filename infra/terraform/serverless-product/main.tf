locals {
  lambda_services = toset(["api", "mcp", "inference"])
  name_prefix     = "${var.project_name}-${var.environment}"
}

resource "aws_dynamodb_table" "tickets" {
  name                        = coalesce(var.tickets_table_name, "${local.name_prefix}-tickets")
  billing_mode                = var.dynamodb_billing_mode
  deletion_protection_enabled = false
  hash_key                    = "ticketId"
  read_capacity               = var.dynamodb_billing_mode == "PROVISIONED" ? var.tickets_read_capacity : null
  write_capacity              = var.dynamodb_billing_mode == "PROVISIONED" ? var.tickets_write_capacity : null

  attribute {
    name = "ticketId"
    type = "S"
  }

  point_in_time_recovery {
    enabled = false
  }

  server_side_encryption {
    enabled = true
  }
}

resource "aws_dynamodb_table" "ticket_embeddings" {
  name                        = coalesce(var.embeddings_table_name, "${local.name_prefix}-ticket-embeddings")
  billing_mode                = var.dynamodb_billing_mode
  deletion_protection_enabled = false
  hash_key                    = "ticketId"
  read_capacity               = var.dynamodb_billing_mode == "PROVISIONED" ? var.embeddings_read_capacity : null
  write_capacity              = var.dynamodb_billing_mode == "PROVISIONED" ? var.embeddings_write_capacity : null

  attribute {
    name = "ticketId"
    type = "S"
  }

  point_in_time_recovery {
    enabled = false
  }

  server_side_encryption {
    enabled = true
  }
}

resource "aws_s3_bucket" "ui_assets" {
  bucket        = var.ui_bucket_name
  bucket_prefix = var.ui_bucket_name == null ? "${local.name_prefix}-ui-" : null
}

resource "aws_s3_bucket_public_access_block" "ui_assets" {
  bucket = aws_s3_bucket.ui_assets.id

  block_public_acls       = !var.enable_static_website_public_read
  block_public_policy     = !var.enable_static_website_public_read
  ignore_public_acls      = !var.enable_static_website_public_read
  restrict_public_buckets = !var.enable_static_website_public_read
}

resource "aws_s3_bucket_ownership_controls" "ui_assets" {
  bucket = aws_s3_bucket.ui_assets.id

  rule {
    object_ownership = "BucketOwnerEnforced"
  }
}

resource "aws_s3_bucket_versioning" "ui_assets" {
  bucket = aws_s3_bucket.ui_assets.id

  versioning_configuration {
    status = "Enabled"
  }
}

resource "aws_s3_bucket_server_side_encryption_configuration" "ui_assets" {
  bucket = aws_s3_bucket.ui_assets.id

  rule {
    apply_server_side_encryption_by_default {
      sse_algorithm = "AES256"
    }
  }
}

resource "aws_s3_bucket_website_configuration" "ui_assets" {
  bucket = aws_s3_bucket.ui_assets.id

  index_document {
    suffix = "index.html"
  }

  error_document {
    key = "index.html"
  }
}

data "aws_iam_policy_document" "ui_public_read" {
  statement {
    sid    = "PublicReadStaticUi"
    effect = "Allow"

    actions = ["s3:GetObject"]

    principals {
      type        = "*"
      identifiers = ["*"]
    }

    resources = ["${aws_s3_bucket.ui_assets.arn}/*"]
  }
}

resource "aws_s3_bucket_policy" "ui_public_read" {
  count  = var.enable_static_website_public_read ? 1 : 0
  bucket = aws_s3_bucket.ui_assets.id
  policy = data.aws_iam_policy_document.ui_public_read.json

  depends_on = [aws_s3_bucket_public_access_block.ui_assets]
}

resource "aws_s3_bucket" "model_artifacts" {
  bucket        = var.model_artifact_bucket_name
  bucket_prefix = var.model_artifact_bucket_name == null ? "${local.name_prefix}-models-" : null
}

resource "aws_s3_bucket_public_access_block" "model_artifacts" {
  bucket = aws_s3_bucket.model_artifacts.id

  block_public_acls       = true
  block_public_policy     = true
  ignore_public_acls      = true
  restrict_public_buckets = true
}

resource "aws_s3_bucket_versioning" "model_artifacts" {
  bucket = aws_s3_bucket.model_artifacts.id

  versioning_configuration {
    status = "Enabled"
  }
}

resource "aws_s3_bucket_server_side_encryption_configuration" "model_artifacts" {
  bucket = aws_s3_bucket.model_artifacts.id

  rule {
    apply_server_side_encryption_by_default {
      sse_algorithm = "AES256"
    }
  }
}

resource "aws_ecr_repository" "lambda" {
  for_each = local.lambda_services

  name                 = "${local.name_prefix}-${each.key}"
  image_tag_mutability = "MUTABLE"

  encryption_configuration {
    encryption_type = "AES256"
  }

  image_scanning_configuration {
    scan_on_push = true
  }
}

resource "aws_ecr_lifecycle_policy" "lambda" {
  for_each   = aws_ecr_repository.lambda
  repository = each.value.name

  policy = jsonencode({
    rules = [
      {
        rulePriority = 1
        description  = "Keep only the three most recent ${each.key} images"
        selection = {
          tagStatus   = "any"
          countType   = "imageCountMoreThan"
          countNumber = 3
        }
        action = {
          type = "expire"
        }
      }
    ]
  })
}

resource "aws_cloudwatch_log_group" "lambda" {
  for_each = local.lambda_services

  name              = "/aws/lambda/${local.name_prefix}-${each.key}"
  retention_in_days = var.log_retention_days
}

data "aws_iam_policy_document" "lambda_assume_role" {
  statement {
    effect = "Allow"

    actions = ["sts:AssumeRole"]

    principals {
      type        = "Service"
      identifiers = ["lambda.amazonaws.com"]
    }
  }
}

resource "aws_iam_role" "api" {
  name               = "${local.name_prefix}-api"
  assume_role_policy = data.aws_iam_policy_document.lambda_assume_role.json
}

resource "aws_iam_role" "mcp" {
  name               = "${local.name_prefix}-mcp"
  assume_role_policy = data.aws_iam_policy_document.lambda_assume_role.json
}

resource "aws_iam_role" "inference" {
  name               = "${local.name_prefix}-inference"
  assume_role_policy = data.aws_iam_policy_document.lambda_assume_role.json
}

data "aws_iam_policy_document" "api" {
  statement {
    sid    = "ReadTicketData"
    effect = "Allow"

    actions = [
      "dynamodb:BatchGetItem",
      "dynamodb:GetItem",
      "dynamodb:Query",
      "dynamodb:Scan"
    ]

    resources = [
      aws_dynamodb_table.tickets.arn,
      aws_dynamodb_table.ticket_embeddings.arn
    ]
  }

  statement {
    sid    = "InvokeBackendLambdas"
    effect = "Allow"

    actions = ["lambda:InvokeFunction"]

    resources = [
      aws_lambda_function.mcp.arn,
      aws_lambda_function.inference.arn
    ]
  }

  statement {
    sid    = "WriteLambdaLogs"
    effect = "Allow"

    actions = [
      "logs:CreateLogStream",
      "logs:PutLogEvents"
    ]

    resources = ["${aws_cloudwatch_log_group.lambda["api"].arn}:*"]
  }
}

resource "aws_iam_role_policy" "api" {
  name   = "${local.name_prefix}-api"
  role   = aws_iam_role.api.id
  policy = data.aws_iam_policy_document.api.json
}

data "aws_iam_policy_document" "mcp" {
  statement {
    sid    = "ReadTicketData"
    effect = "Allow"

    actions = [
      "dynamodb:BatchGetItem",
      "dynamodb:GetItem",
      "dynamodb:Query",
      "dynamodb:Scan"
    ]

    resources = [
      aws_dynamodb_table.tickets.arn,
      aws_dynamodb_table.ticket_embeddings.arn
    ]
  }

  statement {
    sid    = "WriteLambdaLogs"
    effect = "Allow"

    actions = [
      "logs:CreateLogStream",
      "logs:PutLogEvents"
    ]

    resources = ["${aws_cloudwatch_log_group.lambda["mcp"].arn}:*"]
  }
}

resource "aws_iam_role_policy" "mcp" {
  name   = "${local.name_prefix}-mcp"
  role   = aws_iam_role.mcp.id
  policy = data.aws_iam_policy_document.mcp.json
}

data "aws_iam_policy_document" "inference" {
  statement {
    sid    = "ReadModelArtifact"
    effect = "Allow"

    actions = [
      "s3:GetObject",
      "s3:ListBucket"
    ]

    resources = [
      aws_s3_bucket.model_artifacts.arn,
      "${aws_s3_bucket.model_artifacts.arn}/*"
    ]
  }

  statement {
    sid    = "WriteLambdaLogs"
    effect = "Allow"

    actions = [
      "logs:CreateLogStream",
      "logs:PutLogEvents"
    ]

    resources = ["${aws_cloudwatch_log_group.lambda["inference"].arn}:*"]
  }
}

resource "aws_iam_role_policy" "inference" {
  name   = "${local.name_prefix}-inference"
  role   = aws_iam_role.inference.id
  policy = data.aws_iam_policy_document.inference.json
}

resource "aws_lambda_function" "api" {
  function_name = "${local.name_prefix}-api"
  role          = aws_iam_role.api.arn
  package_type  = "Image"
  image_uri     = var.api_lambda_image_uri
  architectures = [var.lambda_architecture]
  memory_size   = var.api_lambda_memory_mb
  timeout       = var.api_lambda_timeout_seconds

  environment {
    variables = {
      EMBEDDINGS_TABLE_NAME          = aws_dynamodb_table.ticket_embeddings.name
      INFERENCE_LAMBDA_FUNCTION_NAME = aws_lambda_function.inference.function_name
      MAX_CANDIDATES                 = tostring(var.max_candidates)
      MCP_LAMBDA_FUNCTION_NAME       = aws_lambda_function.mcp.function_name
      TICKETS_TABLE_NAME             = aws_dynamodb_table.tickets.name
    }
  }

  depends_on = [
    aws_cloudwatch_log_group.lambda,
    aws_iam_role_policy.api
  ]
}

resource "aws_lambda_function" "mcp" {
  function_name = "${local.name_prefix}-mcp"
  role          = aws_iam_role.mcp.arn
  package_type  = "Image"
  image_uri     = var.mcp_lambda_image_uri
  architectures = [var.lambda_architecture]
  memory_size   = var.mcp_lambda_memory_mb
  timeout       = var.mcp_lambda_timeout_seconds

  environment {
    variables = {
      EMBEDDINGS_TABLE_NAME = aws_dynamodb_table.ticket_embeddings.name
      MAX_CANDIDATES        = tostring(var.max_candidates)
      TICKETS_TABLE_NAME    = aws_dynamodb_table.tickets.name
    }
  }

  depends_on = [
    aws_cloudwatch_log_group.lambda,
    aws_iam_role_policy.mcp
  ]
}

resource "aws_lambda_function" "inference" {
  function_name = "${local.name_prefix}-inference"
  role          = aws_iam_role.inference.arn
  package_type  = "Image"
  image_uri     = var.inference_lambda_image_uri
  architectures = [var.lambda_architecture]
  memory_size   = var.inference_lambda_memory_mb
  timeout       = var.inference_lambda_timeout_seconds

  ephemeral_storage {
    size = var.inference_lambda_ephemeral_storage_mb
  }

  environment {
    variables = {
      MAX_CANDIDATES       = tostring(var.max_candidates)
      MAX_GENERATED_TOKENS = tostring(var.max_generated_tokens)
      MODEL_BUCKET         = aws_s3_bucket.model_artifacts.bucket
      MODEL_FAMILY         = "Qwen3-0.6B"
      MODEL_KEY            = var.model_artifact_key
      MODEL_RUNTIME        = "llama.cpp"
    }
  }

  depends_on = [
    aws_cloudwatch_log_group.lambda,
    aws_iam_role_policy.inference
  ]
}

resource "aws_lambda_function_url" "api" {
  count              = var.enable_api_function_url ? 1 : 0
  function_name      = aws_lambda_function.api.function_name
  authorization_type = var.api_function_url_authorization_type

  cors {
    allow_headers = ["authorization", "content-type", "x-request-id"]
    allow_methods = ["GET", "POST"]
    allow_origins = var.function_url_cors_allowed_origins
    max_age       = 300
  }
}

resource "aws_lambda_function_url" "inference" {
  count              = var.enable_inference_function_url ? 1 : 0
  function_name      = aws_lambda_function.inference.function_name
  authorization_type = var.inference_function_url_authorization_type

  cors {
    allow_headers = ["authorization", "content-type", "x-request-id"]
    allow_methods = ["POST"]
    allow_origins = var.function_url_cors_allowed_origins
    max_age       = 300
  }
}
