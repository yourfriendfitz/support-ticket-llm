# Milestone 4: Local Inference Adapter

## Objective

Add a stable inference boundary that can generate cited answers from bounded ticket candidates without requiring a real model in local development or tests.

## Delivered

- `@support-ticket-llm/adapters` workspace package.
- `InferenceAdapter` contract for ticket-answer generation.
- Deterministic mock inference adapter for local/test mode.
- Prompt template for bounded ticket-answer generation.
- Candidate snippet bounding by count and character length.
- Prompt guardrails that treat ticket snippets as untrusted data.
- Citation validation to prevent answers from citing ticket IDs outside the candidate set.
- API `/chat` answer generation after retrieval orchestration.
- Inference diagnostics in API responses.
- `make milestone4-check`.

## Acceptance Criteria

- Generated answers cite ticket IDs.
- Model input receives only bounded candidate snippets.
- Candidate snippets are delimited as untrusted data.
- Citation validation rejects ticket IDs outside the candidate list.
- Local/test mode runs without loading a real model.
- `make milestone4-check` passes.

## Verification

Run:

```bash
make ci
make milestone4-check
```

Smoke checks:

```bash
make dev
curl -X POST http://localhost:4000/chat \
  -H 'content-type: application/json' \
  -d '{"message":"Give me all Lambda timeout tickets from last week"}'
```

Expected response shape:

- `answer` contains cited ticket IDs.
- `citations` contains only cited tickets.
- `diagnostics.retrieval.strategy` is `merged_candidates`.
- `diagnostics.inference.adapter` is `deterministic_mock`.

## Follow-Up

Milestone 5 is documented in [docs/milestone-5.md](milestone-5.md). It keeps deterministic inference as the default, adds an optional Lambda HTTP provider path, and defines the serverless tiny-model Terraform scaffold without committing model artifacts.
