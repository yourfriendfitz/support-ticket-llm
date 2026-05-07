# support-ticket-llm

A support-ticket chatbot built with AWS, Terraform, TypeScript, bounded LLM inference, DynamoDB, lightweight retrieval, vector retrieval, and an MCP data-access boundary.

## Current Status

The project is in Milestone 2: local ticket data and retrieval. The UI, API, and MCP server are wired through Docker Compose, and chat requests now return cited local ticket candidates through the MCP search boundary.

Primary source documents:

- [spec.md](spec.md): build-facing milestone specification.
- [docs/development.md](docs/development.md): repo layout and local workflow.

## Milestone 2 Outcome

Milestone 2 establishes:

- Support-ticket assistant scope for IT support users.
- Local-first, container-first development workflow.
- TypeScript npm workspace.
- React/Vite UI shell.
- Fastify Chat API service.
- MCP server service with real `healthCheck` and `searchTickets` tools.
- Docker Compose app services for UI, API, and MCP server.
- Containerized typecheck, test, and build commands.
- MCP server as the data-access boundary.
- Shared `@support-ticket-llm/core` package for ticket types, seed data, mock embeddings, and retrieval.
- Deterministic hundreds-scale ticket seed generation.
- Hybrid lexical and deterministic vector retrieval for local development.
- API `/chat` responses with cited ticket candidates.

## Local Workflow

Use containers for project tooling. Do not install project dependencies on the host.

```bash
make ci
make milestone2-check
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

Milestone 3 will add richer MCP retrieval tools, query planning, candidate merge controls, and more retrieval smoke checks before local inference work starts.
