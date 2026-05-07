variable "aws_region" {
  description = "AWS region for the serverless inference scaffold."
  type        = string
  default     = "us-east-2"
}

variable "project_name" {
  description = "Project name used for AWS resource naming."
  type        = string
  default     = "support-ticket-llm"
}

variable "environment" {
  description = "Environment name used for AWS resource naming."
  type        = string
  default     = "dev"
}

variable "model_artifact_bucket_name" {
  description = "Optional globally unique bucket name for quantized GGUF model artifacts. Leave null to use a generated prefix."
  type        = string
  default     = null
}

variable "model_artifact_key" {
  description = "S3 object key for the quantized Qwen3 GGUF model artifact."
  type        = string
  default     = "models/qwen3-0.6b-q4_k_m.gguf"
}

variable "lambda_image_uri" {
  description = "ECR image URI for the Lambda container that runs llama.cpp inference."
  type        = string
}

variable "lambda_architecture" {
  description = "Lambda CPU architecture for the inference container."
  type        = string
  default     = "arm64"

  validation {
    condition     = contains(["arm64", "x86_64"], var.lambda_architecture)
    error_message = "lambda_architecture must be arm64 or x86_64."
  }
}

variable "lambda_memory_mb" {
  description = "Memory allocated to the inference Lambda."
  type        = number
  default     = 1024
}

variable "lambda_timeout_seconds" {
  description = "Maximum inference Lambda runtime per request."
  type        = number
  default     = 30
}

variable "lambda_ephemeral_storage_mb" {
  description = "Ephemeral storage for downloading the model artifact to /tmp."
  type        = number
  default     = 512
}

variable "max_candidates" {
  description = "Maximum ticket candidates the Lambda inference handler may accept."
  type        = number
  default     = 5
}

variable "max_generated_tokens" {
  description = "Maximum generated-token budget enforced by the Lambda inference handler."
  type        = number
  default     = 256
}

variable "enable_function_url" {
  description = "Create an IAM-authorized Lambda Function URL for manual integration testing."
  type        = bool
  default     = false
}

variable "function_url_authorization_type" {
  description = "Authorization mode for the optional Lambda Function URL. Keep AWS_IAM unless a controlled test endpoint has handler-level auth."
  type        = string
  default     = "AWS_IAM"

  validation {
    condition     = contains(["AWS_IAM", "NONE"], var.function_url_authorization_type)
    error_message = "function_url_authorization_type must be AWS_IAM or NONE."
  }
}
