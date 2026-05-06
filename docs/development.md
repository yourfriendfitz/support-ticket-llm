# Development Workflow

## Current Phase

The repository is in Milestone 0. The application is not implemented yet.

Current workflow goals:

- Keep the repo buildable from a clear spec.
- Establish container-first tooling before adding code.
- Make first implementation tasks obvious for another engineer.

## Container-First Policy

Project tooling must run through containers by default.

Use:

```bash
make compose-config
make doctor
make dev-shell
```

Avoid:

```bash
npm install
npm run build
node scripts/example.js
```

When Node workspace files exist, run equivalent commands inside the tools container:

```bash
docker compose run --rm tools npm install
docker compose run --rm tools npm run build
docker compose run --rm tools npm test
```

The exact package scripts will be added in Milestone 1.

## Planned Monorepo Layout

```text
apps/
  ui/           Chat UI
  api/          Chat API and orchestration service
  mcp-server/   MCP data-access server
packages/
  core/         Shared schemas, types, validation, and ranking logic
  adapters/     Bedrock, DynamoDB, search, vector, and MCP client adapters
infra/
  terraform/    AWS infrastructure modules and stacks
ops/
  k8s/          EKS manifests or Helm chart
scripts/        Seed, index, evaluation, and utility scripts
data/           Local ticket fixtures and generated sample data
evals/          Retrieval and answer-quality evaluation fixtures
docs/           Decision records and engineering notes
```

## Planned Local Services

Milestone 1 should add:

- UI container.
- API container.
- MCP server container.
- Health checks for API and MCP server.

Milestone 2 should add:

- DynamoDB Local or compatible local substitute.
- Elasticsearch-compatible search container.
- Qdrant vector database container.
- Seed and indexing commands.

## Environment Configuration

Use checked-in examples for required environment variables and keep real secrets local.

Expected future files:

- `.env.example`: safe defaults and required variable names.
- `.env`: ignored local secrets and overrides.

Bedrock usage:

- Local development must work with a deterministic mock LLM when AWS credentials are unavailable.
- Real Bedrock calls should only happen after AWS SSO is configured and the user explicitly starts that work.

## Verification

Current Milestone 0 checks:

```bash
make milestone0-check
```

Future source-code changes should add and use containerized commands for:

- Formatting.
- Linting.
- Typechecking.
- Unit tests.
- Build.
- Retrieval evaluation.
