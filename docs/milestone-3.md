# Milestone 3: MCP Data Tools And Retrieval Orchestration

## Objective

Make retrieval orchestration explicit: the Chat API should plan a ticket query, call MCP retrieval tools, merge candidates, hydrate canonical ticket records, and return cited results without model inference.

## Delivered

- Core ticket lookup helpers: `getTicketById` and `getTicketsByIds`.
- Vector-only `semanticSearchTickets`.
- Query planner for service filters, last-week date windows, result limits, and recency sorting.
- Candidate merge, dedupe, rank, and canonical hydration logic.
- MCP tools for `semanticSearchTickets`, `getTicketById`, and `getTicketsByIds`.
- API `/chat` orchestration through MCP lexical search, semantic search, and hydration.
- Retrieval evaluation fixtures in `evals/retrieval/queries.json`.
- Retrieval metrics script with `npm run eval:retrieval`.
- `make milestone3-check`.

## Acceptance Criteria

- MCP tools can retrieve tickets through search and canonical ticket hydration.
- Tools reject malformed inputs and enforce bounded list sizes.
- API query planning infers Lambda service filters and last-week date windows.
- "Give me all Lambda timeout tickets from last week" returns a bounded cited list without model inference.
- Retrieval evaluation passes for the checked-in query set.
- `make milestone3-check` passes.

## Verification

Run:

```bash
make ci
make milestone3-check
```

Smoke checks:

```bash
make dev
curl http://localhost:4001/health
curl http://localhost:4000/health
curl http://localhost:4000/health/deep
curl -X POST http://localhost:4000/chat \
  -H 'content-type: application/json' \
  -d '{"message":"Give me all Lambda timeout tickets from last week"}'
```

## Next Tasks For Milestone 4

1. Add an inference adapter interface.
2. Add deterministic mock inference for local/test mode.
3. Add prompt templates for bounded candidate reranking and answer generation.
4. Add prompt-injection guardrails around ticket snippets and user input.
5. Keep `llama.cpp` optional until the adapter contract is stable.
