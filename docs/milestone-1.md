# Milestone 1: Local App Skeleton

## Objective

Create a local, containerized application skeleton with a working UI -> API -> MCP service path.

## Delivered

- npm workspace rooted at `package.json`.
- Shared TypeScript base configuration.
- React/Vite UI shell in `apps/ui`.
- Fastify Chat API service in `apps/api`.
- MCP server service in `apps/mcp-server`.
- Real MCP `healthCheck` tool exposed over streamable HTTP.
- API `/health`, `/health/deep`, and `/chat` endpoints.
- Docker Compose services for `ui`, `api`, `mcp-server`, and `tools`.
- Containerized install, typecheck, test, build, and development targets in `Makefile`.

## Acceptance Criteria

- `make dev` starts UI, API, and MCP server containers.
- UI can send a message to the API.
- API can call the MCP server `healthCheck` tool.
- `make milestone1-check` passes.

## Verification

Run:

```bash
make ci
make milestone1-check
make dev
```

Smoke checks:

```bash
curl http://localhost:4001/health
curl http://localhost:4000/health
curl http://localhost:4000/health/deep
curl -X POST http://localhost:4000/chat \
  -H 'content-type: application/json' \
  -d '{"message":"Give me the latest ticket about Lambda timeouts"}'
```

## Milestone 2 Follow-Up

Milestone 2 work is tracked in [milestone-2.md](milestone-2.md).
