# Milestone 2: Local Ticket Data And Retrieval

## Objective

Add deterministic local support-ticket data and make the UI -> API -> MCP path return cited retrieval results without model inference.

## Delivered

- Shared `@support-ticket-llm/core` workspace package.
- Support-ticket schemas and constants.
- Deterministic 240-ticket seed generator.
- Deterministic mock embedding generation.
- Hybrid lexical and vector retrieval.
- `make seed` command that writes generated files to `data/local`.
- MCP `searchTickets` tool with bounded input validation.
- API `/chat` orchestration through MCP `searchTickets`.
- UI citation rendering for matching tickets.
- Retrieval-focused tests across core, API, and MCP server.

## Acceptance Criteria

- `make seed` creates `data/local/tickets.json` and `data/local/ticket-embeddings.json`.
- Search includes structured ticket fields and free-text fields.
- Vector retrieval uses deterministic mock embeddings for local testing.
- `searchTickets` enforces bounded result limits.
- `POST /chat` returns cited ticket candidates for the default Lambda timeout query.
- `make milestone2-check` passes.

## Verification

Run:

```bash
make ci
make milestone2-check
```

Smoke checks:

```bash
make dev
curl http://localhost:4001/health
curl http://localhost:4000/health
curl http://localhost:4000/health/deep
curl -X POST http://localhost:4000/chat \
  -H 'content-type: application/json' \
  -d '{"message":"Give me the latest ticket about Lambda timeouts"}'
```

## Next Tasks For Milestone 3

1. Add `getTicketById` and `getTicketsByIds` MCP tools.
2. Add explicit semantic-search controls if the UI/API needs separate vector-only retrieval.
3. Add query planning in the Chat API for filters, date ranges, and result limits.
4. Add candidate merge, dedupe, and ranking controls.
5. Add retrieval evaluation fixtures and metrics scripts.
