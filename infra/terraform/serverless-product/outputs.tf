output "tickets_table_name" {
  description = "DynamoDB table for canonical support tickets."
  value       = aws_dynamodb_table.tickets.name
}

output "ticket_embeddings_table_name" {
  description = "DynamoDB table for precomputed ticket embeddings."
  value       = aws_dynamodb_table.ticket_embeddings.name
}

output "ui_bucket_name" {
  description = "S3 bucket for static UI assets."
  value       = aws_s3_bucket.ui_assets.bucket
}

output "ui_website_endpoint" {
  description = "S3 static website endpoint for the hosted UI."
  value       = aws_s3_bucket_website_configuration.ui_assets.website_endpoint
}

output "model_artifact_bucket_name" {
  description = "S3 bucket for quantized model artifacts."
  value       = aws_s3_bucket.model_artifacts.bucket
}

output "ecr_repository_urls" {
  description = "ECR repositories for API, MCP, and inference Lambda images."
  value = {
    for service, repository in aws_ecr_repository.lambda : service => repository.repository_url
  }
}

output "api_lambda_function_name" {
  description = "Serverless API Lambda function name."
  value       = aws_lambda_function.api.function_name
}

output "mcp_lambda_function_name" {
  description = "Serverless MCP Lambda function name."
  value       = aws_lambda_function.mcp.function_name
}

output "inference_lambda_function_name" {
  description = "Tiny-model inference Lambda function name."
  value       = aws_lambda_function.inference.function_name
}

output "api_function_url" {
  description = "Optional API Lambda Function URL when enabled."
  value       = var.enable_api_function_url ? aws_lambda_function_url.api[0].function_url : null
}

output "inference_function_url" {
  description = "Optional inference Lambda Function URL when enabled."
  value       = var.enable_inference_function_url ? aws_lambda_function_url.inference[0].function_url : null
}
