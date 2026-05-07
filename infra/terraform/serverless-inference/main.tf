locals {
  name_prefix = "${var.project_name}-${var.environment}"
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

resource "aws_ecr_repository" "inference" {
  name                 = "${local.name_prefix}-inference"
  image_tag_mutability = "MUTABLE"

  encryption_configuration {
    encryption_type = "AES256"
  }

  image_scanning_configuration {
    scan_on_push = true
  }
}

resource "aws_ecr_lifecycle_policy" "inference" {
  repository = aws_ecr_repository.inference.name

  policy = jsonencode({
    rules = [
      {
        rulePriority = 1
        description  = "Keep only the three most recent inference images"
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

resource "aws_cloudwatch_log_group" "inference" {
  name              = "/aws/lambda/${local.name_prefix}-inference"
  retention_in_days = 7
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

resource "aws_iam_role" "inference" {
  name               = "${local.name_prefix}-inference"
  assume_role_policy = data.aws_iam_policy_document.lambda_assume_role.json
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

    resources = ["${aws_cloudwatch_log_group.inference.arn}:*"]
  }
}

resource "aws_iam_role_policy" "inference" {
  name   = "${local.name_prefix}-inference"
  role   = aws_iam_role.inference.id
  policy = data.aws_iam_policy_document.inference.json
}

resource "aws_lambda_function" "inference" {
  function_name = "${local.name_prefix}-inference"
  role          = aws_iam_role.inference.arn
  package_type  = "Image"
  image_uri     = var.lambda_image_uri
  architectures = [var.lambda_architecture]
  memory_size   = var.lambda_memory_mb
  timeout       = var.lambda_timeout_seconds

  ephemeral_storage {
    size = var.lambda_ephemeral_storage_mb
  }

  environment {
    variables = {
      MODEL_BUCKET         = aws_s3_bucket.model_artifacts.bucket
      MODEL_KEY            = var.model_artifact_key
      MODEL_FAMILY         = "Qwen3-0.6B"
      MODEL_RUNTIME        = "llama.cpp"
      MAX_CANDIDATES       = tostring(var.max_candidates)
      MAX_GENERATED_TOKENS = tostring(var.max_generated_tokens)
    }
  }

  depends_on = [
    aws_cloudwatch_log_group.inference,
    aws_iam_role_policy.inference
  ]
}

resource "aws_lambda_function_url" "inference" {
  count = var.enable_function_url ? 1 : 0

  function_name      = aws_lambda_function.inference.function_name
  authorization_type = var.function_url_authorization_type

  cors {
    allow_credentials = false
    allow_headers     = ["content-type", "authorization"]
    allow_methods     = ["POST"]
    allow_origins     = ["*"]
    max_age           = 300
  }
}
