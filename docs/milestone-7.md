# Milestone 7: Serverless AWS Product Slice

## Objective

Create the first deployable AWS product-slice scaffold without leaving the Free account plan constraints. The stack is intentionally low traffic, serverless, and opt-in for public endpoints.

## Delivered

- Terraform stack in `infra/terraform/serverless-product`.
- DynamoDB table for canonical support tickets.
- DynamoDB table for precomputed ticket embeddings.
- S3 static website bucket for UI assets.
- Private S3 bucket for the quantized Qwen3-0.6B model artifact.
- ECR repositories for API, MCP, and inference Lambda images.
- API Lambda, MCP Lambda, and `llama.cpp` inference Lambda resources.
- Optional Lambda Function URLs, disabled by default and IAM-authorized unless deliberately changed.
- CloudWatch log groups with 7-day retention.
- IAM role policies scoped to each Lambda responsibility.
- Dockerized helper targets for AWS identity and Terraform validation.
- Offline scaffold validation through `make milestone7-check`.

## Free-Plan Guardrails

- No AWS Organizations, Control Tower, EKS, NAT Gateway, VPC endpoints, OpenSearch, Bedrock, RDS, or provisioned concurrency.
- DynamoDB defaults to `PROVISIONED` with 1 read and 1 write capacity unit per table.
- Static UI public read is disabled by default.
- API and inference Function URLs are disabled by default.
- The model artifact bucket blocks public access.
- CloudWatch log retention defaults to 7 days.

## Workflow

Verify the local AWS profile without installing the AWS CLI on the host:

```bash
make aws-whoami
```

Format and validate the Terraform stack through containers:

```bash
make terraform-product-fmt
make terraform-product-init
make terraform-product-validate
```

Run the full milestone gate:

```bash
make milestone7-check
```

## Apply Readiness

Do not apply the product stack until:

- AWS Budget alerts are configured.
- The non-root CLI profile returns the intended account and IAM user.
- API, MCP, and inference container images are built and pushed to ECR.
- Static UI public-read settings are reviewed.
- Function URL auth settings are reviewed.

## Acceptance Criteria

- Terraform defines the AWS resources required for the first hosted product slice.
- The stack can be initialized and validated through containerized Terraform.
- The default stack avoids the known Free account plan risk resources.
- Local deterministic checks remain the quality gate before cloud deployment.
