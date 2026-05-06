# support-ticket-llm

A support-ticket chatbot built with AWS, Terraform, TypeScript, LLM inference, DynamoDB, Elasticsearch-compatible search, vector retrieval, and an MCP data-access boundary.

## Current Status

The project is in Milestone 0: spec and repo foundation. Application code has not started yet.

Primary source documents:

- [spec.md](spec.md): build-facing milestone specification.
- [docs/development.md](docs/development.md): repo layout and local workflow.

## Milestone 0 Outcome

Milestone 0 establishes:

- Support-ticket assistant scope for IT support users.
- Local-first, container-first development workflow.
- Planned TypeScript monorepo structure.
- MCP server as the data-access boundary.
- DynamoDB as source of truth.
- Elasticsearch-compatible search plus vector search for hybrid retrieval.
- AWS Bedrock as the first LLM provider.
- EKS and Terraform as the AWS deployment direction.

## Local Workflow

Use containers for project tooling. Do not install project dependencies on the host.

```bash
make compose-config
make doctor
make dev-shell
```

The current Compose setup only provides a Node tooling container. Application and data-service containers will be added in Milestone 1 and Milestone 2.

## Planned Repository Layout

```text
apps/
  api/          Chat API and orchestration service
  mcp-server/   MCP data-access server
  ui/           Chat UI
packages/
  adapters/     Bedrock, search, vector, and DynamoDB adapters
  core/         Shared schemas, types, and retrieval logic
infra/
  terraform/    AWS infrastructure
ops/
  k8s/          EKS manifests or Helm chart
scripts/        Seed, index, evaluation, and utility scripts
data/           Local fixtures and generated sample data
evals/          Retrieval and answer evaluation fixtures
docs/           Project decisions and development docs
```

## Next Milestone

Milestone 1 will create the TypeScript workspace, Chat UI shell, Chat API service, MCP server service, Docker Compose app services, and health checks.
