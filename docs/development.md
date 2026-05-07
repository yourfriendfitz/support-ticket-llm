# Development Workflow

## Current Phase

The repository is in Milestone 2. The local UI, API, MCP server, seed data, and retrieval path are implemented.

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
make milestone2-check
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
  adapters/     Inference, DynamoDB, search, vector, and MCP client adapters
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

## Environment Configuration

Use checked-in examples for required environment variables and keep real secrets local.

Expected future files:

- `.env.example`: safe defaults and required variable names.
- `.env`: ignored local secrets and overrides.

Inference usage:

- Local development must work with a deterministic mock inference adapter by default.
- Optional local model testing can use `llama.cpp` and the same Qwen3-0.6B model family planned for Lambda.
- AWS inference calls should only happen through a non-root CLI/IAM setup and explicit deployment work.

## Verification

Current Milestone 2 checks:

```bash
make milestone2-check
```

This runs:

- Compose configuration validation.
- TypeScript typecheck.
- Unit tests.
- Production build.
- Seed/index generation.

For a live smoke test:

```bash
make dev
curl http://localhost:4001/health
curl http://localhost:4000/health
curl http://localhost:4000/health/deep
curl -X POST http://localhost:4000/chat \
  -H 'content-type: application/json' \
  -d '{"message":"Give me the latest ticket about Lambda timeouts"}'
```
