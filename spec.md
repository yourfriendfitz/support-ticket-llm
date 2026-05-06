# Support Ticket Assistant Spec

## 1. Purpose

Build a support-ticket chatbot with AWS, Terraform, TypeScript, bounded LLM inference, DynamoDB, lightweight retrieval, vector retrieval, and an MCP data-access boundary.

The project should be built as a real product codebase with clear service boundaries, measurable retrieval quality, bounded LLM behavior, repeatable local development, and a path to AWS deployment.

## 2. Product Summary

An IT support person can ask natural-language questions about support tickets. The system retrieves matching tickets through an MCP data-access boundary, combines structured filters with lexical and vector retrieval, and uses a bounded LLM inference step only after retrieval narrows the candidate set.

Example questions:

- "Give me the latest ticket about Lambda timeouts."
- "Give me all Lambda timeout tickets from last week."
- "Summarize the most severe EKS networking tickets."
- "Which open tickets look similar to this error message?"

The LLM should not scan the whole dataset or directly access databases. Retrieval systems should narrow the candidate set first. The inference runtime should only receive a small, sanitized candidate set.

## 3. Users

Primary user: an IT support person who needs to find, compare, and summarize support tickets quickly.

Secondary user: an engineer or operator reviewing the implementation, architecture, tradeoffs, and deployment plan.

## 4. Goals

- Provide a local-first implementation that can later deploy to AWS.
- Implement a real MCP server as the system's data-access boundary.
- Use DynamoDB as the canonical ticket store.
- Use lightweight lexical retrieval first, with a path to Elasticsearch/OpenSearch only if the dataset or query needs justify it.
- Use vector retrieval over ticket text while keeping the first cloud slice free-plan-conscious.
- Use self-hosted tiny-model inference for the first AWS integration path, with Bedrock as a later optional provider.
- Support single-record and multi-record natural-language requests.
- Include measurable latency, throughput, monitoring, and evaluation targets.
- Keep the architecture clear, maintainable, and operationally explainable.

## 5. Non-Goals

- Production-grade enterprise auth, RBAC, tenant isolation, or compliance workflows.
- Large-scale data ingestion. Initial scale is hundreds of tickets.
- EKS, OpenSearch, Bedrock, and other higher-cost managed services in the first AWS deployment.
- Full prompt engineering platform or multi-agent architecture.
- Letting the LLM directly query databases or execute arbitrary tools.

Large-model serving, distillation, TensorRT, and TorchServe should be documented as future tradeoff topics, not MVP implementation requirements.

## 6. Initial Technical Decisions

| Area | Decision | Rationale |
| --- | --- | --- |
| Language | TypeScript | Aligns with target stack and keeps UI/API/MCP code in one ecosystem. |
| Source of truth | DynamoDB | Provides a scalable operational store for canonical support-ticket records. |
| Primary search | Lightweight lexical retrieval first | Keeps MVP infrastructure lean while supporting keyword, metadata, date filters, sorting, and explainable retrieval. |
| Semantic search | Precomputed embeddings with adapter boundary | Keeps vector retrieval real without requiring a paid vector database for the first cloud slice. |
| LLM provider | Self-hosted Qwen3-0.6B path first | Supports AWS Free Plan experimentation with a small quantized model and keeps Bedrock optional later. |
| Data boundary | Real MCP server | Makes the data-access interface explicit, enforceable, and independently testable. |
| Deployment | Local containers first, serverless AWS later | Supports repeatable local development and a lean AWS deployment path. |
| Infrastructure | Terraform | Required for reproducible AWS setup, starting with minimal/no-cost scaffolding. |

## 7. High-Level Architecture

```text
User
  -> Chat UI
  -> Chat API / Orchestrator
  -> MCP Client
  -> MCP Server
      -> DynamoDB ticket store
      -> lightweight lexical retrieval
      -> vector retrieval adapter
  -> LLM inference adapter
  -> Chat API response with cited tickets
```

Core rule: the MCP server owns data access. The orchestrator can call MCP tools, retrieve candidates, and then call an inference adapter with only the minimum candidate snippets needed for generation.

First AWS inference slice:

```text
Local Chat API / Orchestrator
  -> AWS Lambda inference endpoint
      -> Qwen3-0.6B quantized model through llama.cpp
      -> model artifact loaded from S3 into /tmp on cold start
  -> generated answer fragment
```

The first cloud slice should prove the model inference path before moving the whole UI/API/retrieval flow into AWS.

## 8. Component Responsibilities

### Chat UI

- Provides a simple chat interface for IT support users.
- Shows final answer, matching ticket cards, confidence/relevance indicators, and cited ticket IDs.
- Supports single-ticket and multi-ticket responses.
- Does not talk directly to databases or model runtimes.

### Chat API / Orchestrator

- Accepts user messages from the UI.
- Performs lightweight query planning:
  - Detect likely single-ticket vs multi-ticket intent.
  - Extract obvious filters such as service, date range, status, severity, and recency.
  - Avoid using the LLM for broad database exploration.
- Calls MCP tools for search and ticket hydration.
- Merges lexical and vector candidates.
- Sends bounded candidate snippets to the inference adapter for final inference and response generation.
- Returns structured response data to the UI.

### MCP Server

- Exposes data-access tools to the orchestrator.
- Owns adapters for DynamoDB, lexical retrieval, and vector retrieval.
- Enforces tool schemas and result limits.
- Returns normalized ticket records and search metadata.
- Prevents the LLM from directly controlling database access.

Initial MCP tools:

| Tool | Purpose |
| --- | --- |
| `searchTickets` | Search tickets with query text, filters, sort, and limit. Backed initially by lightweight lexical retrieval and DynamoDB data. |
| `semanticSearchTickets` | Find semantically similar tickets using vector search. |
| `getTicketById` | Fetch canonical ticket details from DynamoDB. |
| `getTicketsByIds` | Hydrate a bounded list of candidate tickets from DynamoDB. |
| `getTicketStats` | Return simple aggregate counts for explainable summaries if needed. |

### DynamoDB

- Canonical store for support ticket records.
- Holds structured fields and free-text fields.
- Used for authoritative reads after search candidates are selected.

### Lightweight Lexical Search

- Initial primary retrieval layer.
- Handles keyword search, metadata filters, time-window filters, sorting, and pagination.
- Can run locally over seeded ticket data and later against DynamoDB-backed records.
- Should be optimized before relying on the LLM.
- Elasticsearch/OpenSearch remains a later upgrade path if the dataset or query complexity requires it.

### Vector Retrieval

- Stores or loads embeddings for ticket title, description, symptoms, and resolution text.
- Supports semantic matches where exact keywords are missing.
- Should be implemented through an adapter so local and AWS options can differ.

Initial local option: precomputed embeddings in local fixtures or a lightweight in-process index.

Initial AWS option: precomputed embeddings stored with ticket data in DynamoDB, with similarity calculated in Lambda over a bounded candidate set.

Deferred options: Qdrant, OpenSearch vector capabilities, or another managed vector service.

### Self-Hosted Tiny Model Inference

- Performs only bounded inference over candidate tickets.
- Responsibilities:
  - Rerank candidate tickets when free-text meaning matters.
  - Infer whether a ticket matches the user's intent.
  - Summarize selected ticket content.
  - Generate the final answer using citations.
- Must not receive full database dumps.
- Must not receive credentials or direct tool access.
- Initial target model: Qwen3-0.6B quantized GGUF.
- Initial runtime direction: `llama.cpp` in a Lambda container image.
- Initial model packaging: model artifact stored in S3 and downloaded to `/tmp` on cold start.
- Initial generated-token limit: 128-256 tokens.

Bedrock remains a future provider behind the same inference adapter if the account plan and cost profile justify it.

## 9. Data Model

Initial dataset size: hundreds of support tickets.

Initial DynamoDB table: `SupportTickets`.

Primary key:

- `ticketId`: string

Candidate fields:

| Field | Type | Purpose |
| --- | --- | --- |
| `ticketId` | string | Stable ticket identifier. |
| `createdAt` | ISO datetime string | Date filtering and recency sorting. |
| `updatedAt` | ISO datetime string | Recency and stale-ticket detection. |
| `status` | string enum | `open`, `in_progress`, `blocked`, `resolved`, `closed`. |
| `priority` | string enum | `low`, `medium`, `high`, `critical`. |
| `service` | string | AWS or platform area such as `lambda`, `eks`, `dynamodb`, `iam`, `api_gateway`. |
| `environment` | string | `dev`, `stage`, `prod`, or `shared`. |
| `requesterTeam` | string | Team or group that opened the ticket. |
| `assignee` | string | Support owner. |
| `title` | string | Short ticket title. |
| `description` | string | Main free-text field for search and inference. |
| `symptoms` | string | Observed errors, logs, or behavior. |
| `resolutionSummary` | string optional | What fixed the issue if resolved. |
| `tags` | string array | Search and grouping hints. |
| `impactScore` | number | Numeric field for ranking and severity heuristics. |

Useful secondary access patterns:

- Tickets by status and creation date.
- Tickets by service and creation date.
- Tickets by priority and status.

For the MVP, lightweight retrieval can own most filtered access, so DynamoDB secondary indexes can stay minimal until access patterns harden.

## 10. Indexing Model

Ticket data should be synchronized from DynamoDB into:

- Lightweight lexical index for local search and filters.
- Precomputed embedding records for vector retrieval.

Initial implementation can use a deterministic seed/index script.

Later implementation can add an indexer worker:

```text
DynamoDB stream or polling job
  -> normalize ticket document
  -> update lightweight lexical index
  -> generate embedding
  -> update vector retrieval store
```

For initial local scale, eventual consistency is acceptable if the UI or logs make indexing state clear.

## 11. Query Flow

### Single-Ticket Request

Example: "Give me the latest ticket about Lambda timeouts."

Expected flow:

1. Orchestrator detects likely single-ticket intent and recency requirement.
2. Orchestrator extracts filters: service `lambda`, topic `timeouts`, sort `createdAt desc`, limit candidate count.
3. MCP `searchTickets` retrieves top lexical matches from the lightweight search adapter.
4. MCP `semanticSearchTickets` retrieves semantic matches for "Lambda timeouts."
5. Orchestrator merges and deduplicates candidates.
6. MCP `getTicketsByIds` hydrates canonical records from DynamoDB.
7. The inference adapter reranks or validates the small candidate set.
8. API returns the top ticket with a short explanation and ticket citation.

### Multi-Ticket Request

Example: "Give me all Lambda timeout tickets from last week."

Expected flow:

1. Orchestrator detects multi-ticket intent.
2. Orchestrator extracts date range for last week, service `lambda`, and topic `timeouts`.
3. MCP `searchTickets` retrieves matching records using filters and lexical query.
4. MCP `semanticSearchTickets` may add semantic matches if lexical results are weak.
5. Orchestrator merges and applies result limits.
6. The inference adapter summarizes common themes across the bounded result set.
7. API returns a list of tickets plus a short summary.

## 12. LLM Security Requirements

Ticket text is untrusted input. The system must defend against prompt injection and accidental tool misuse.

Requirements:

- The inference runtime receives candidate snippets, not direct database access.
- System prompts must tell the model to treat ticket content as data, not instructions.
- Tool schemas must be owned by the orchestrator and MCP server, not generated dynamically by the model.
- MCP result limits must prevent unbounded data extraction.
- Responses should cite ticket IDs used to generate the answer.
- The system should prefer "not enough evidence" over unsupported answers.
- Logs should avoid secrets and avoid dumping full prompts by default.

Out of scope for MVP:

- Full auth/RBAC.
- Tenant isolation.
- Enterprise compliance reporting.

## 13. Performance Targets

Initial targets:

| Path | Target |
| --- | --- |
| Retrieval-only response | p95 under 2 seconds locally for hundreds of tickets. |
| Generated answer with local/mock inference | p95 under 5 seconds for local bounded candidate sets. |
| Generated answer with Lambda-hosted tiny model | No strict target initially; measure cold-start and warm latency separately. |
| Local MVP throughput | 5 requests per second sustained for simple retrieval paths. |
| Candidate set sent to inference | Default max 10 tickets unless explicitly changed. |
| Generated token cap | 128-256 tokens for the first self-hosted model path. |
| Local memory budget | Prefer under 8 GB total for Docker Compose. |
| Node service memory | Prefer under 512 MB per service for API and MCP server. |

These are initial engineering targets, not hard production SLOs.

## 14. Measurement And Evaluation

The project should include a small evaluation set of natural-language queries with expected ticket IDs.

Example metrics:

- `precision@k` for retrieved ticket IDs.
- `recall@k` for multi-ticket queries.
- Mean reciprocal rank for single-ticket queries.
- Empty-result rate.
- Inference latency and token usage.
- Lexical search latency.
- Vector search latency.
- DynamoDB read latency.
- Percentage of answers with citations.
- User feedback rating if added later.

The evaluation should make tradeoffs visible:

- Keyword-only vs vector-only vs hybrid retrieval.
- Search-only answer vs generated answer.
- Larger candidate set vs latency and token cost.

## 15. Observability

Every request should have a correlation ID.

Logs should capture:

- Request ID.
- Parsed filters.
- Search strategy used.
- Candidate counts from lexical and vector search.
- Final ticket IDs used in the answer.
- Inference latency and token counts if available.
- Error category without exposing secrets.

Metrics should capture:

- API p50/p95 latency.
- MCP tool latency.
- Lexical search latency.
- Vector search latency.
- DynamoDB latency.
- Inference latency.
- Inference token usage and estimated cost.
- Error rates by component.

AWS deployment should use CloudWatch-compatible logs and metrics. Local development can use console logs first, then add OpenTelemetry if useful.

## 16. Infrastructure Direction

### Local Development

Run everything through containers by default.

Expected local services:

- Chat UI.
- Chat API / orchestrator.
- MCP server.
- DynamoDB Local or compatible local substitute.
- Lightweight lexical retrieval adapter.
- Vector retrieval adapter.
- Seed/index scripts.
- Mock inference adapter by default.
- Optional local `llama.cpp` adapter for testing the same model path before Lambda.

Inference local behavior:

- Default local development uses a deterministic mock inference adapter.
- Optional local model development uses `llama.cpp` and the same quantized model family intended for Lambda.
- Real cloud inference calls should only happen after AWS credentials and Terraform state are configured.

### AWS Deployment

Use Terraform for infrastructure.

First AWS shape:

- Static UI hosting through S3 when the UI is ready for cloud deployment.
- DynamoDB for ticket store.
- Lambda inference endpoint running `llama.cpp` with Qwen3-0.6B.
- S3 model artifact bucket for quantized GGUF files.
- ECR for Lambda container images if container packaging is used.
- IAM roles with least-privilege access to model artifacts and logs.
- CloudWatch for logs and metrics.

Deferred AWS services:

- EKS.
- OpenSearch.
- Bedrock.
- NAT Gateways.
- Managed vector databases.

AWS CLI access should use a non-root IAM profile. Root should remain limited to account, billing, and security tasks.

## 17. Model Serving And Compression Discussion

MVP uses a small self-hosted model path, so model compression is part of the first AWS inference design. GPU serving is not part of the first AWS deployment.

The architecture should still document these production tradeoffs:

- Bedrock reduces operational burden but is deferred until the account plan and cost profile justify it.
- Self-hosting improves control over model choice and keeps the first cloud slice lean, but increases packaging and cold-start complexity.
- ONNX Runtime can help optimize CPU inference for supported models.
- TensorRT is relevant for GPU-optimized inference.
- TorchServe is relevant for PyTorch model serving but adds operational overhead.
- Quantization can reduce memory and latency, often with some accuracy risk.
- Distillation can produce a smaller task-specific model, but requires training/evaluation effort.
- CPU serving may be cheaper and simpler for small models or low throughput.
- GPU serving may be justified for high throughput, larger models, or strict latency goals.

Future feature: add Bedrock behind the same inference adapter if hosted-model quality and operational simplicity become worth the cost.

## 18. Milestones

### Milestone 0: Spec And Repo Foundation

Deliverables:

- `spec.md` finalized enough to build from.
- Project structure selected.
- Local container-first workflow defined.
- Development conventions documented.

Acceptance criteria:

- Another engineer can identify components, boundaries, and first implementation tasks.
- Open decisions are explicitly listed.

### Milestone 1: Local App Skeleton

Deliverables:

- TypeScript workspace.
- Chat UI shell.
- Chat API service.
- MCP server service.
- Docker Compose local environment.
- Health checks for API and MCP server.

Acceptance criteria:

- User can start the local stack with one documented command.
- UI can send a message to the API.
- API can call a health/check tool on the MCP server.

### Milestone 2: Local Ticket Data And Retrieval

Deliverables:

- DynamoDB local table or equivalent.
- Seed support-ticket dataset with hundreds of records.
- Lightweight lexical retrieval index.
- Precomputed embedding fixture format.
- Seed/index script.
- Retrieval adapter interfaces for lexical and vector search.

Acceptance criteria:

- Seed command creates tickets and indexes them.
- Search index contains structured fields and free-text fields.
- Vector retrieval contains embeddings or deterministic mock embeddings for local testing.

### Milestone 3: MCP Data Tools And Retrieval Orchestration

Deliverables:

- `searchTickets` MCP tool.
- `semanticSearchTickets` MCP tool.
- `getTicketById` MCP tool.
- `getTicketsByIds` MCP tool.
- Tool input validation and bounded result limits.
- Query planning in the Chat API.
- Lexical and vector candidate retrieval.
- Candidate merge, dedupe, and rank logic.

Acceptance criteria:

- MCP tools can retrieve tickets through search and DynamoDB.
- Tools reject malformed inputs.
- Tools enforce default and maximum limits.
- "Give me the latest ticket about Lambda timeouts" returns one cited ticket without model inference.
- "Give me all Lambda timeout tickets from last week" returns a bounded list without model inference.

### Milestone 4: Local Inference Adapter

Deliverables:

- LLM/inference adapter interface.
- Deterministic mock inference adapter for local/test mode.
- Optional local `llama.cpp` adapter.
- Prompt templates for bounded candidate reranking and answer generation.
- Prompt-injection guardrails.

Acceptance criteria:

- Generated answers cite ticket IDs.
- Model input receives only bounded candidate snippets.
- System runs locally without loading a real model by default.

### Milestone 5: Serverless Tiny-Model Inference

Deliverables:

- Terraform scaffold for minimal AWS resources.
- S3 bucket for model artifacts.
- ECR repository or build flow for Lambda container image.
- Lambda inference function running `llama.cpp`.
- Qwen3-0.6B quantized GGUF artifact flow.
- Local API adapter that can call the deployed inference Lambda.

Acceptance criteria:

- Terraform can plan the minimal inference resources.
- Lambda cold-start and warm latency are measured.
- Lambda enforces candidate and generated-token limits.
- Root credentials are not used for CLI or Terraform.

### Milestone 6: Evaluation And Observability

Deliverables:

- Evaluation query set.
- Retrieval metrics script.
- Structured logs with request IDs.
- Basic latency metrics.
- Optional user feedback capture.

Acceptance criteria:

- Evaluation can compare keyword-only, vector-only, hybrid retrieval, and generated answers.
- Logs show search strategy, candidate counts, and final cited ticket IDs.
- Latency can be measured per component.

### Milestone 7: Serverless AWS Product Slice

Deliverables:

- Terraform modules or stacks for required AWS resources.
- Static UI hosting.
- API Gateway or Lambda Function URL.
- MCP Lambda/service.
- DynamoDB table.
- Serverless lexical and vector retrieval over DynamoDB-backed data.
- Inference Lambda integration.
- CloudWatch logging.

Acceptance criteria:

- AWS deployment can be planned with Terraform.
- After non-root CLI profile configuration, the stack can be deployed to a selected AWS account and region.
- Hosted UI can ask a ticket question and receive cited results from the serverless backend.

### Milestone 8: Managed Service Upgrade Evaluation

Deliverables:

- Architecture note comparing serverless self-hosted inference with Bedrock.
- Architecture note comparing lightweight retrieval with OpenSearch/vector database options.
- Notes on ONNX Runtime, TensorRT, TorchServe, quantization, and distillation.

Acceptance criteria:

- Tradeoffs are documented clearly enough to guide future implementation decisions.
- No dependency on EKS, OpenSearch, or Bedrock is required for the MVP.

## 19. Current Decisions And Remaining Open Decisions

Resolved:

- Planned repo shape is a TypeScript monorepo with `apps`, `packages`, `infra`, `ops`, `scripts`, `data`, and `evals`.
- Initial package manager is npm.
- Planned UI framework is React with Vite.
- Planned API framework is Fastify.
- Planned MCP implementation uses the official TypeScript MCP SDK, with exact version pinned during implementation.
- Planned local vector retrieval starts with precomputed embeddings and adapter boundaries.
- Search remains behind a retrieval adapter.
- Preferred AWS search path starts with DynamoDB-backed lightweight retrieval.
- Qwen3-0.6B with `llama.cpp` is the first self-hosted model path.
- Model artifacts should live in S3 and download to Lambda `/tmp` on cold start.
- Local inference uses a mock adapter by default, with optional local `llama.cpp` parity testing.
- Lightweight auth is deferred unless it materially improves the product slice without distracting from retrieval and LLM security.
- Initial seed-ticket taxonomy covers common AWS support areas: Lambda, EKS, DynamoDB, IAM, API Gateway, S3, CloudWatch, and OpenSearch.

Remaining open decisions:

- Exact dependency versions.
- Exact quantized Qwen3-0.6B GGUF artifact.
- Exact AWS Lambda packaging and build flow.
- Whether the first serverless API uses API Gateway or Lambda Function URLs.

## 20. Definition Of Done For MVP

The MVP is done when:

- The local stack runs through containers.
- The UI can ask support-ticket questions.
- The API talks to data only through the MCP server.
- DynamoDB stores canonical ticket data.
- Lightweight lexical retrieval handles primary retrieval.
- Vector search contributes semantic candidates.
- Mock, local `llama.cpp`, or Lambda-hosted `llama.cpp` inference performs bounded generation over retrieved candidates.
- Responses include cited ticket IDs.
- Single-ticket and multi-ticket examples work.
- Basic evaluation and latency measurement exist.
- The architecture and tradeoffs are documented well enough to guide implementation and operations.
