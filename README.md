# support-ticket-llm

A support-ticket chatbot built with AWS, Terraform, TypeScript, bounded LLM inference, DynamoDB, lightweight retrieval, vector retrieval, and an MCP data-access boundary.

## Current Status

The project is in Milestone 6: evaluation and observability. The UI, API, and MCP server run locally through Docker Compose, chat requests use MCP retrieval plus deterministic local answer generation by default, and responses now include request IDs, component latencies, retrieval counts, and final cited ticket IDs.

Primary source documents:

- [spec.md](spec.md): build-facing milestone specification.
- [docs/development.md](docs/development.md): repo layout and local workflow.

## Milestone 6 Outcome

Milestone 6 establishes:

- Support-ticket assistant scope for IT support users.
- Local-first, container-first development workflow.
- TypeScript npm workspace.
- React/Vite UI shell.
- Fastify Chat API service.
- MCP server service with real `healthCheck`, `searchTickets`, `semanticSearchTickets`, `getTicketById`, and `getTicketsByIds` tools.
- Docker Compose app services for UI, API, and MCP server.
- Containerized typecheck, test, and build commands.
- MCP server as the data-access boundary.
- Shared `@support-ticket-llm/core` package for ticket types, seed data, mock embeddings, and retrieval.
- Deterministic hundreds-scale ticket seed generation.
- Hybrid lexical and deterministic vector retrieval for local development.
- API `/chat` query planning, candidate merge/dedupe/rank, canonical ticket hydration, and cited ticket candidates.
- Retrieval evaluation fixtures and a metrics command.
- `@support-ticket-llm/adapters` package for inference boundaries.
- Deterministic mock inference for local/test mode.
- Prompt templates with bounded, untrusted ticket snippets.
- Citation validation so generated answers cite only retrieved candidate ticket IDs.
- API `/chat` generated answers with inference diagnostics.
- Optional `aws_lambda_http` inference adapter behind the same inference contract.
- Environment-based inference provider selection with deterministic mock as the default.
- Terraform scaffold for S3 model artifacts, ECR image storage, Lambda image inference, IAM, CloudWatch logs, and optional IAM-authorized Function URL.
- Safe environment examples for future cloud inference wiring.
- Offline scaffold verification through `make milestone5-check`.
- Structured `/chat` observability with request IDs, component latency, retrieval strategy, candidate counts, and final cited ticket IDs.
- Retrieval evaluation that compares keyword-only, vector-only, and hybrid merged strategies.
- Deterministic answer-quality evaluation fixtures for generated answers and citations.
- Offline Milestone 6 verification through `make milestone6-check`.

## Local Workflow

Use containers for project tooling. Do not install project dependencies on the host.

```bash
make ci
make milestone6-check
make dev
```

Generate local seed/index files:

```bash
make seed
```

Local ports:

- UI: `http://localhost:5173`
- API: `http://localhost:4000`
- MCP server: `http://localhost:4001`

Useful health checks:

```bash
curl http://localhost:4001/health
curl http://localhost:4000/health
curl http://localhost:4000/health/deep
```

## Repository Layout

```text
apps/
  api/          Chat API and orchestration service
  mcp-server/   MCP data-access server
  ui/           Chat UI
packages/
  adapters/     Inference, search, vector, and DynamoDB adapters
  core/         Shared schemas, types, and retrieval logic
infra/
  terraform/    AWS infrastructure
ops/
  k8s/          Deferred Kubernetes manifests or Helm chart
scripts/        Seed, index, evaluation, and utility scripts
data/           Local fixtures and generated sample data
evals/          Retrieval and answer evaluation fixtures
docs/           Project decisions and development docs
```

## Next Milestone

Milestone 7 will move toward a deployable serverless AWS product slice after AWS profile and deployment prerequisites are ready.
