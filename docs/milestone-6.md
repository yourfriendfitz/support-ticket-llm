# Milestone 6: Evaluation And Observability

## Objective

Make local quality and runtime behavior measurable before moving more of the system into AWS. The milestone keeps evaluation deterministic and containerized.

## Delivered

- `/chat` response diagnostics under `diagnostics.observability`.
- Structured API log event for completed chat requests.
- Request IDs surfaced in responses and logs.
- Component latency for retrieval, inference, and total chat handling.
- Retrieval candidate counts for lexical, semantic, hydrated, and returned tickets.
- Final cited ticket IDs recorded after safety filtering.
- Retrieval evaluation comparing `keywordOnly`, `vectorOnly`, and `hybridMerged`.
- Deterministic answer-quality evaluation fixtures in `evals/answers/queries.json`.
- `make eval-answers`.
- `make milestone6-check`.

## Observability Fields

Each successful `/chat` response includes:

```json
{
  "diagnostics": {
    "observability": {
      "requestId": "req-1",
      "componentLatencyMs": {
        "retrieval": 12.34,
        "inference": 1.23,
        "total": 13.57
      },
      "retrievalStrategy": "merged_candidates",
      "retrievalCandidateCounts": {
        "lexical": 2,
        "semantic": 0,
        "hydrated": 2,
        "returned": 2
      },
      "finalCitedTicketIds": ["TCK-0002", "TCK-0001"]
    }
  }
}
```

The API also logs the same core fields as a structured `chat request completed` event.

## Evaluation Commands

Run:

```bash
make eval-retrieval
make eval-answers
make milestone6-check
```

Retrieval evaluation reports all retrieval variants but only requires `hybridMerged` to pass all expected ticket cases. That preserves useful comparison data without blocking the build on intentionally weaker baselines.

Answer evaluation checks deterministic generated answers for:

- Expected cited ticket IDs.
- Expected answer substrings.
- Passing citation validation.

## Acceptance Criteria

- Evaluation compares keyword-only, vector-only, and hybrid merged retrieval.
- Generated-answer evaluation checks cited ticket IDs and expected answer content.
- `/chat` responses include request ID, retrieval strategy, candidate counts, final cited ticket IDs, and component latency.
- API logs include structured fields for request ID, strategy, candidate counts, final cited ticket IDs, citation validation, and latency.
- `make milestone6-check` passes.

## Next Tasks For Milestone 7

1. Decide whether to configure a non-root AWS CLI profile before Terraform planning.
2. Add serverless API/retrieval infrastructure only after AWS access is ready.
3. Keep local evals as the quality gate for cloud changes.
