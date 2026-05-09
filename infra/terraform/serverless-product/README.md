# Serverless Product Terraform Stack

This stack is the Milestone 7 AWS product-slice scaffold. It extends the inference-only stack with the resources needed for a small hosted proof of concept while staying inside the Free account plan constraints we selected.

## Resources

- DynamoDB table for canonical support tickets.
- DynamoDB table for precomputed ticket embeddings.
- S3 static website bucket for UI assets.
- Private S3 bucket for the quantized model artifact.
- ECR repositories for API, MCP, and inference Lambda container images.
- Lambda functions for API, MCP retrieval, and tiny-model inference.
- Optional Lambda Function URLs, disabled by default and IAM-authorized unless explicitly changed.
- CloudWatch log groups with short retention.
- Least-scope IAM role policies for each Lambda.

## Free-Plan Guardrails

- No AWS Organizations, Control Tower, EKS, NAT Gateway, VPC endpoints, OpenSearch, Bedrock, RDS, or provisioned concurrency.
- DynamoDB defaults to `PROVISIONED` with 1 read and 1 write capacity unit per table.
- Function URLs are disabled by default. If enabled, keep `AWS_IAM` unless the handler enforces its own auth for a controlled demo.
- Static website public read is disabled by default. Enable only when publishing non-secret UI assets.
- The model bucket blocks public access.

## Plan

Use the Dockerized Terraform workflow from the repository root:

```bash
docker run --rm \
  -v "$PWD:/workspace" \
  -w /workspace/infra/terraform/serverless-product \
  hashicorp/terraform:1.9.8 init -backend=false

docker run --rm \
  -v "$PWD:/workspace" \
  -v "$HOME/.aws:/root/.aws:ro" \
  -w /workspace/infra/terraform/serverless-product \
  -e AWS_PROFILE=support-ticket-llm \
  hashicorp/terraform:1.9.8 plan -var-file=terraform.tfvars.example
```

The example variable file contains placeholder image URIs. Replace them with pushed ECR image URIs before applying.

## Apply Readiness

Do not run `terraform apply` until:

- AWS Budget alerts are configured in the account.
- The Dockerized AWS CLI profile returns the intended non-root IAM identity.
- API, MCP, and inference container images are built and pushed.
- Static UI public-read and Function URL auth settings have been reviewed deliberately.
