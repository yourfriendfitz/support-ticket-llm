# Development Workflow

## Current Phase

The repository is in Milestone 7. The local UI, API, MCP server, seed data, retrieval path, query planning, candidate hydration, retrieval and answer evaluation paths, deterministic inference adapter, optional Lambda HTTP inference adapter, `/chat` observability diagnostics, and serverless AWS product-slice Terraform scaffold are implemented.

Current workflow goals:

- Keep all project commands containerized.
- Preserve the UI -> API -> MCP health path while adding future services.
- Keep source changes covered by typecheck, test, and build.

## Container-First Policy

Project tooling must run through containers by default.

Use:

```bash
make compose-config
make ci
make doctor
make dev-shell
make milestone7-check
```

Avoid:

```bash
npm install
npm run build
node scripts/example.js
```

When Node workspace files exist, run equivalent commands inside the tools container:

```bash
docker compose run --rm tools npm ci
docker compose run --rm tools npm run build
docker compose run --rm tools npm test
```

The root `Makefile` wraps these commands for normal use.

## Planned Monorepo Layout

```text
apps/
  ui/           Chat UI
  api/          Chat API and orchestration service
  mcp-server/   MCP data-access server
packages/
  core/         Shared schemas, types, validation, and ranking logic
  adapters/     Inference adapter contracts, local mock inference, and future provider adapters
infra/
  terraform/    AWS infrastructure modules and stacks
ops/
  k8s/          Deferred Kubernetes manifests or Helm chart
scripts/        Seed, index, evaluation, and utility scripts
data/           Local ticket fixtures and generated sample data
evals/          Retrieval and answer-quality evaluation fixtures
docs/           Decision records and engineering notes
```

## Local Services

Milestone 1 includes:

- UI container.
- API container.
- MCP server container.
- Health checks for API and MCP server.

Milestone 2 adds:

- Compatible local substitute for DynamoDB-backed ticket access.
- Lightweight lexical retrieval.
- Deterministic mock embedding fixtures.
- Seed and indexing commands through `make seed`.
- MCP `searchTickets` and API `/chat` citations.

Milestone 3 adds:

- MCP `semanticSearchTickets`, `getTicketById`, and `getTicketsByIds`.
- API query planning for service filters, last-week windows, limits, and recency.
- Candidate merge, dedupe, rank, and canonical hydration.
- Retrieval evaluation fixtures and `make eval-retrieval`.

Milestone 4 adds:

- `@support-ticket-llm/adapters` inference adapter package.
- Deterministic mock inference for local/test mode.
- Prompt templates with bounded, untrusted ticket snippets.
- Citation validation for generated ticket answers.
- API `/chat` answer generation after retrieval orchestration.

Milestone 5 adds:

- Optional `aws_lambda_http` inference adapter behind the stable adapter contract.
- `INFERENCE_PROVIDER` configuration with `deterministic_mock` as the default.
- Generated-token, candidate-count, snippet-size, and timeout limits for cloud inference requests.
- Terraform scaffold for the future `llama.cpp` Lambda path.
- `.env.example` and `make milestone5-check`.

Milestone 6 adds:

- Structured `/chat` logs for request ID, retrieval strategy, candidate counts, final cited ticket IDs, citation validation, and component latency.
- Response diagnostics under `diagnostics.observability`.
- Retrieval evaluation metrics for keyword-only, vector-only, and hybrid merged strategies.
- Deterministic answer-quality evaluation through `make eval-answers`.
- `make milestone6-check`.

Milestone 7 adds:

- Serverless product Terraform stack in `infra/terraform/serverless-product`.
- DynamoDB tables for canonical tickets and precomputed embeddings.
- Static UI S3 website bucket, private model-artifact S3 bucket, and ECR repositories.
- API, MCP, and inference Lambda resources with CloudWatch log retention.
- Optional Lambda Function URLs disabled by default.
- Dockerized helper targets for AWS identity and Terraform formatting/validation.
- `make milestone7-check`.

## Environment Configuration

Use checked-in examples for required environment variables and keep real secrets local.

Expected future files:

- `.env.example`: safe defaults and required variable names.
- `.env`: ignored local secrets and overrides.

Inference usage:

- Local development must work with a deterministic mock inference adapter by default.
- Optional Lambda HTTP model testing uses `INFERENCE_PROVIDER=aws_lambda_http` and the same Qwen3-0.6B model family planned for Lambda.
- AWS inference calls should only happen through a non-root CLI/IAM setup, explicit deployment work, and an explicit `INFERENCE_LAMBDA_URL`.

Safe defaults are documented in `.env.example`:

- `INFERENCE_PROVIDER=deterministic_mock`
- `INFERENCE_LAMBDA_URL=`
- `INFERENCE_MAX_CANDIDATES=5`
- `INFERENCE_MAX_SNIPPET_CHARACTERS=480`
- `INFERENCE_MAX_GENERATED_TOKENS=256`
- `INFERENCE_REQUEST_TIMEOUT_MS=15000`

## Verification

Current Milestone 7 checks:

```bash
make milestone7-check
```

This runs:

- Compose configuration validation.
- TypeScript typecheck.
- Unit tests.
- Production build.
- Seed/index generation.
- Retrieval evaluation.
- Inference adapter tests.
- Offline serverless inference scaffold validation.
- Answer-quality evaluation.
- Offline observability/evaluation scaffold validation.
- Offline serverless product-slice scaffold validation.

Additional AWS/Terraform helpers:

```bash
make aws-whoami
make terraform-product-fmt
make terraform-product-init
make terraform-product-validate
```

For a live smoke test:

```bash
make dev
curl http://localhost:4001/health
curl http://localhost:4000/health
curl http://localhost:4000/health/deep
curl -X POST http://localhost:4000/chat \
  -H 'content-type: application/json' \
  -d '{"message":"Give me all Lambda timeout tickets from last week"}'
```
