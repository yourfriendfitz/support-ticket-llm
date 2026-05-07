output "model_artifact_bucket_name" {
  description = "S3 bucket that stores quantized GGUF model artifacts."
  value       = aws_s3_bucket.model_artifacts.bucket
}

output "ecr_repository_url" {
  description = "ECR repository URL for the Lambda inference container image."
  value       = aws_ecr_repository.inference.repository_url
}

output "lambda_function_name" {
  description = "Name of the serverless inference Lambda function."
  value       = aws_lambda_function.inference.function_name
}

output "lambda_function_arn" {
  description = "ARN of the serverless inference Lambda function."
  value       = aws_lambda_function.inference.arn
}

output "lambda_function_url" {
  description = "Optional IAM-authorized Lambda Function URL, when enabled."
  value       = try(aws_lambda_function_url.inference[0].function_url, null)
}
