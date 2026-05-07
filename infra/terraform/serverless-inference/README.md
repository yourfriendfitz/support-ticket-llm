# Serverless Inference Terraform Scaffold

This directory defines the first AWS inference slice for the support-ticket assistant. It is a scaffold for planning and later deployment, not a complete cloud rollout.

## What It Creates

- S3 bucket for quantized GGUF model artifacts.
- ECR repository for a Lambda container image.
- Lambda function configured for `llama.cpp` and Qwen3-0.6B.
- CloudWatch log group with short retention.
- Least-privilege Lambda role for reading model artifacts and writing logs.
- Optional Lambda Function URL, disabled by default and IAM-authorized unless explicitly changed.

## Explicit Non-Goals

- No model binaries are committed to the repo.
- No root AWS credentials should be used for Terraform.
- No public unauthenticated inference endpoint is created by default.
- No API Gateway, DynamoDB, hosted UI, or Bedrock resources are included yet.

## Plan Workflow

Use a non-root AWS profile before running Terraform:

```bash
export AWS_PROFILE=support-ticket-llm-dev
terraform init
terraform plan -var-file=terraform.tfvars
```

Start from `terraform.tfvars.example`, then replace `lambda_image_uri` with the image URI produced by the future container build.

The Lambda handler must enforce the same request contract used by `INFERENCE_PROVIDER=aws_lambda_http`:

- Accept a bounded `prompt` object.
- Enforce `limits.maxCandidates`.
- Enforce `limits.maxGeneratedTokens`.
- Return JSON with `answer` and `citedTicketIds`.

The current API adapter is a plain HTTP client with optional bearer auth. If the Function URL remains `AWS_IAM`, add SigV4 signing or an authenticated proxy before direct local API calls. If `function_url_authorization_type = "NONE"` is used for a controlled test, the Lambda handler should enforce its own bearer token.
