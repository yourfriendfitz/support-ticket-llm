# Milestone 0: Spec And Repo Foundation

## Objective

Prepare the repository so Milestone 1 can start implementation without re-litigating architecture, layout, or workflow.

## Deliverables

- `spec.md` is the build-facing product and architecture spec.
- `README.md` explains project status and links to key docs.
- `docs/development.md` defines local container-first development.
- Placeholder directories define the planned monorepo layout.
- `compose.yaml` and `Makefile` provide minimal containerized tooling checks.

## Acceptance Criteria

- Another engineer can identify the system components and boundaries.
- Another engineer can identify the first implementation tasks.
- Open decisions are listed explicitly.
- Project tooling has a container-first entrypoint.

## First Tasks For Milestone 1

1. Initialize the npm workspace.
2. Add TypeScript base config and package scripts.
3. Create the React/Vite UI shell.
4. Create the Fastify API service with `/health`.
5. Create the MCP server service with a health/check tool.
6. Wire UI -> API -> MCP health path through Docker Compose.
7. Add containerized format, lint, typecheck, test, and build commands.
