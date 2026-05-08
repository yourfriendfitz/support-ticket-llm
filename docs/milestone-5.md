# Milestone 5: Serverless Tiny-Model Inference Scaffold

## Objective

Prepare the first AWS inference slice without making local development depend on AWS or committing model artifacts. The deterministic mock adapter remains the default; cloud inference is opt-in.

## Delivered

- Optional `aws_lambda_http` inference adapter behind the existing `InferenceAdapter` contract.
- API provider selection through `INFERENCE_PROVIDER`.
- Bounded Lambda request payload with candidate-count and generated-token limits.
- Lambda response citation validation against retrieved ticket candidates.
- `.env.example` with safe local defaults.
- Terraform scaffold for model artifact S3 bucket, ECR repository, Lambda image function, IAM role/policy, CloudWatch log group, and optional Function URL that is IAM-authorized by default.
- S3 model artifact key convention for Qwen3-0.6B quantized GGUF files.
- ECR lifecycle policy to keep only a small number of container images.
- `make milestone5-check`.

## Configuration

Default local mode:

```bash
INFERENCE_PROVIDER=deterministic_mock
```

Future Lambda HTTP mode:

```bash
INFERENCE_PROVIDER=aws_lambda_http
INFERENCE_LAMBDA_URL=https://example.lambda-url.us-east-2.on.aws/
INFERENCE_MAX_CANDIDATES=5
INFERENCE_MAX_SNIPPET_CHARACTERS=480
INFERENCE_MAX_GENERATED_TOKENS=256
INFERENCE_REQUEST_TIMEOUT_MS=15000
```

`INFERENCE_LAMBDA_URL` is required only when `INFERENCE_PROVIDER=aws_lambda_http`.

## Terraform Scaffold

The stack lives in `infra/terraform/serverless-inference`.

It is intended for later planning/deployment with a non-root AWS profile. It does not create a public unauthenticated endpoint by default, and it does not include model binaries or a built Lambda image.

The current API adapter is a plain HTTP client with optional bearer auth. Direct calls to an `AWS_IAM` Function URL require a later SigV4 signing layer or authenticated proxy.

Start from:

```bash
cp terraform.tfvars.example terraform.tfvars
```

Then replace `lambda_image_uri` with the future inference image URI before running Terraform.

## Acceptance Criteria

- Local/test mode still runs without a model or AWS credentials.
- API rejects `aws_lambda_http` mode unless `INFERENCE_LAMBDA_URL` is set.
- Lambda HTTP requests include bounded prompt candidates and `maxGeneratedTokens`.
- Lambda HTTP responses are citation-validated against retrieved candidate ticket IDs.
- Terraform scaffold defines S3, ECR, Lambda, IAM, CloudWatch, and optional Function URL resources.
- Model binaries are ignored and absent from the repo.
- Root AWS credentials are not required or documented for Terraform.
- `make milestone5-check` passes.

## Deferred Until Deployment

- Building the actual `llama.cpp` Lambda container image.
- Uploading a quantized Qwen3-0.6B GGUF artifact.
- Running `terraform plan` against a configured non-root AWS profile.
- Measuring Lambda cold-start and warm latency.

## Follow-Up

Milestone 6 is documented in [docs/milestone-6.md](milestone-6.md). It adds evaluation and observability around retrieval quality, generated answers, request IDs, and component latency.
