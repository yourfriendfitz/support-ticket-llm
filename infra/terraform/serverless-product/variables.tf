variable "aws_region" {
  description = "AWS region for the serverless product slice."
  type        = string
  default     = "us-east-2"
}

variable "project_name" {
  description = "Project name prefix used for AWS resource names."
  type        = string
  default     = "support-ticket-llm"
}

variable "environment" {
  description = "Deployment environment suffix used for AWS resource names."
  type        = string
  default     = "dev"
}

variable "tickets_table_name" {
  description = "Optional fixed DynamoDB table name for canonical tickets."
  type        = string
  default     = null
}

variable "embeddings_table_name" {
  description = "Optional fixed DynamoDB table name for precomputed ticket embeddings."
  type        = string
  default     = null
}

variable "dynamodb_billing_mode" {
  description = "DynamoDB billing mode. PROVISIONED with 1/1 capacity keeps the dev slice explicit and free-plan-safe for low traffic."
  type        = string
  default     = "PROVISIONED"

  validation {
    condition     = contains(["PROVISIONED", "PAY_PER_REQUEST"], var.dynamodb_billing_mode)
    error_message = "dynamodb_billing_mode must be PROVISIONED or PAY_PER_REQUEST."
  }
}

variable "tickets_read_capacity" {
  description = "Provisioned read capacity for the tickets table when dynamodb_billing_mode is PROVISIONED."
  type        = number
  default     = 1
}

variable "tickets_write_capacity" {
  description = "Provisioned write capacity for the tickets table when dynamodb_billing_mode is PROVISIONED."
  type        = number
  default     = 1
}

variable "embeddings_read_capacity" {
  description = "Provisioned read capacity for the embeddings table when dynamodb_billing_mode is PROVISIONED."
  type        = number
  default     = 1
}

variable "embeddings_write_capacity" {
  description = "Provisioned write capacity for the embeddings table when dynamodb_billing_mode is PROVISIONED."
  type        = number
  default     = 1
}

variable "ui_bucket_name" {
  description = "Optional fixed S3 bucket name for hosted static UI assets."
  type        = string
  default     = null
}

variable "enable_static_website_public_read" {
  description = "Allow public read access to the static UI website bucket. Keep false until the UI is ready to publish."
  type        = bool
  default     = false
}

variable "model_artifact_bucket_name" {
  description = "Optional fixed S3 bucket name for model artifacts."
  type        = string
  default     = null
}

variable "model_artifact_key" {
  description = "Object key for the quantized model artifact uploaded separately."
  type        = string
  default     = "models/qwen3-0.6b-q4_k_m.gguf"
}

variable "api_lambda_image_uri" {
  description = "Container image URI for the serverless API Lambda."
  type        = string
}

variable "mcp_lambda_image_uri" {
  description = "Container image URI for the serverless MCP Lambda."
  type        = string
}

variable "inference_lambda_image_uri" {
  description = "Container image URI for the tiny-model inference Lambda."
  type        = string
}

variable "lambda_architecture" {
  description = "Lambda container architecture."
  type        = string
  default     = "arm64"

  validation {
    condition     = contains(["arm64", "x86_64"], var.lambda_architecture)
    error_message = "lambda_architecture must be arm64 or x86_64."
  }
}

variable "api_lambda_memory_mb" {
  description = "Memory for the serverless API Lambda."
  type        = number
  default     = 512
}

variable "api_lambda_timeout_seconds" {
  description = "Timeout for the serverless API Lambda."
  type        = number
  default     = 15
}

variable "mcp_lambda_memory_mb" {
  description = "Memory for the serverless MCP Lambda."
  type        = number
  default     = 512
}

variable "mcp_lambda_timeout_seconds" {
  description = "Timeout for the serverless MCP Lambda."
  type        = number
  default     = 15
}

variable "inference_lambda_memory_mb" {
  description = "Memory for the tiny-model inference Lambda."
  type        = number
  default     = 1024
}

variable "inference_lambda_timeout_seconds" {
  description = "Timeout for the tiny-model inference Lambda."
  type        = number
  default     = 30
}

variable "inference_lambda_ephemeral_storage_mb" {
  description = "Ephemeral storage for the tiny-model inference Lambda."
  type        = number
  default     = 512
}

variable "log_retention_days" {
  description = "CloudWatch log retention for Lambda log groups."
  type        = number
  default     = 7
}

variable "max_candidates" {
  description = "Maximum candidate tickets sent to inference."
  type        = number
  default     = 5
}

variable "max_generated_tokens" {
  description = "Maximum generated tokens for the tiny model."
  type        = number
  default     = 256
}

variable "enable_api_function_url" {
  description = "Create a Lambda Function URL for the API Lambda."
  type        = bool
  default     = false
}

variable "api_function_url_authorization_type" {
  description = "Authorization mode for the optional API Function URL. Use NONE only for controlled tests with handler-level auth."
  type        = string
  default     = "AWS_IAM"

  validation {
    condition     = contains(["AWS_IAM", "NONE"], var.api_function_url_authorization_type)
    error_message = "api_function_url_authorization_type must be AWS_IAM or NONE."
  }
}

variable "enable_inference_function_url" {
  description = "Create a Lambda Function URL for manual inference Lambda tests."
  type        = bool
  default     = false
}

variable "inference_function_url_authorization_type" {
  description = "Authorization mode for the optional inference Function URL. Keep AWS_IAM unless testing a handler-authenticated endpoint."
  type        = string
  default     = "AWS_IAM"

  validation {
    condition     = contains(["AWS_IAM", "NONE"], var.inference_function_url_authorization_type)
    error_message = "inference_function_url_authorization_type must be AWS_IAM or NONE."
  }
}

variable "function_url_cors_allowed_origins" {
  description = "CORS allowed origins for optional Function URLs."
  type        = list(string)
  default     = ["*"]
}
