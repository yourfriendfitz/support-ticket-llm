# support-ticket-llm

A support-ticket chatbot built with AWS, Terraform, TypeScript, bounded LLM inference, DynamoDB, lightweight retrieval, vector retrieval, and an MCP data-access boundary.

## Current Status

The project is in Milestone 1: local app skeleton. The UI, API, and MCP server are wired through Docker Compose with a health-check path.

Primary source documents:

- [spec.md](spec.md): build-facing milestone specification.
- [docs/development.md](docs/development.md): repo layout and local workflow.

## Milestone 1 Outcome

Milestone 1 establishes:

- Support-ticket assistant scope for IT support users.
- Local-first, container-first development workflow.
- TypeScript npm workspace.
- React/Vite UI shell.
- Fastify Chat API service.
- MCP server service with a real `healthCheck` tool.
- Docker Compose app services for UI, API, and MCP server.
- Containerized typecheck, test, and build commands.
- MCP server as the data-access boundary.

## Local Workflow

Use containers for project tooling. Do not install project dependencies on the host.

```bash
make ci
make milestone1-check
make dev
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

Milestone 2 will add local ticket data, DynamoDB Local or a compatible substitute, lightweight lexical retrieval, precomputed embedding fixtures, and seed/index commands.
