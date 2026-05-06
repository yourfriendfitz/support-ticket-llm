# Support Ticket Assistant Spec

## 1. Purpose

Build a support-ticket chatbot with AWS, Terraform, TypeScript, LLM inference, DynamoDB, Elasticsearch-compatible search, vector retrieval, and an MCP data-access boundary.

The project should be built as a real product codebase with clear service boundaries, measurable retrieval quality, bounded LLM behavior, repeatable local development, and a path to AWS deployment.

## 2. Product Summary

An IT support person can ask natural-language questions about support tickets. The system retrieves matching tickets from DynamoDB-backed data using an MCP data-access boundary, Elasticsearch-compatible search, vector search, and a bounded LLM inference step through AWS Bedrock.

Example questions:

- "Give me the latest ticket about Lambda timeouts."
- "Give me all Lambda timeout tickets from last week."
- "Summarize the most severe EKS networking tickets."
- "Which open tickets look similar to this error message?"

The LLM should not scan the whole dataset or directly access databases. Search systems should narrow the candidate set first. Bedrock should only infer over a small, sanitized candidate set.

## 3. Users

Primary user: an IT support person who needs to find, compare, and summarize support tickets quickly.

Secondary user: an engineer or operator reviewing the implementation, architecture, tradeoffs, and deployment plan.

## 4. Goals

- Provide a local-first implementation that can later deploy to AWS.
- Implement a real MCP server as the system's data-access boundary.
- Use DynamoDB as the canonical ticket store.
- Use Elasticsearch-compatible search as the primary retrieval layer for keyword, metadata, and date-filtered queries.
- Use a vector database to support semantic retrieval over ticket text.
- Use AWS Bedrock for isolated LLM inference after candidate retrieval.
- Support single-record and multi-record natural-language requests.
- Include measurable latency, throughput, monitoring, and evaluation targets.
- Keep the architecture clear, maintainable, and operationally explainable.

## 5. Non-Goals

- Production-grade enterprise auth, RBAC, tenant isolation, or compliance workflows.
- Large-scale data ingestion. Initial scale is hundreds of tickets.
- Self-hosted model serving in the first implementation.
- Full prompt engineering platform or multi-agent architecture.
- Letting the LLM directly query databases or execute arbitrary tools.

Self-hosted inference, quantization, distillation, ONNX Runtime, TensorRT, and TorchServe should be documented as future tradeoff topics, not MVP implementation requirements.

## 6. Initial Technical Decisions

| Area | Decision | Rationale |
| --- | --- | --- |
| Language | TypeScript | Aligns with target stack and keeps UI/API/MCP code in one ecosystem. |
| Source of truth | DynamoDB | Provides a scalable operational store for canonical support-ticket records. |
| Primary search | Elasticsearch-compatible search | Best fit for keyword, filters, date ranges, sorting, and explainable retrieval. |
| Semantic search | Vector database adapter | Supports semantic matching against free-text ticket content. |
| LLM provider | AWS Bedrock | Avoids self-hosted model complexity while staying AWS-native. |
| Data boundary | Real MCP server | Makes the data-access interface explicit, enforceable, and independently testable. |
| Deployment | Local containers first, AWS EKS later | Supports repeatable local development and container-first deployment. |
| Infrastructure | Terraform | Required for later AWS deployment and reproducible infrastructure. |

## 7. High-Level Architecture

```text
User
  -> Chat UI
  -> Chat API / Orchestrator
  -> MCP Client
  -> MCP Server
      -> DynamoDB ticket store
      -> Elasticsearch-compatible ticket index
      -> Vector database
  -> AWS Bedrock inference
  -> Chat API response with cited tickets
```

Core rule: the MCP server owns data access. The orchestrator can call MCP tools, retrieve candidates, and then call Bedrock with only the minimum candidate snippets needed for inference.

## 8. Component Responsibilities

### Chat UI

- Provides a simple chat interface for IT support users.
- Shows final answer, matching ticket cards, confidence/relevance indicators, and cited ticket IDs.
- Supports single-ticket and multi-ticket responses.
- Does not talk directly to databases or Bedrock.

### Chat API / Orchestrator

- Accepts user messages from the UI.
- Performs lightweight query planning:
  - Detect likely single-ticket vs multi-ticket intent.
  - Extract obvious filters such as service, date range, status, severity, and recency.
  - Avoid using the LLM for broad database exploration.
- Calls MCP tools for search and ticket hydration.
- Merges lexical and vector candidates.
- Sends bounded candidate snippets to Bedrock for final inference and response generation.
- Returns structured response data to the UI.

### MCP Server

- Exposes data-access tools to the orchestrator.
- Owns adapters for DynamoDB, Elasticsearch-compatible search, and vector search.
- Enforces tool schemas and result limits.
- Returns normalized ticket records and search metadata.
- Prevents the LLM from directly controlling database access.

Initial MCP tools:

| Tool | Purpose |
| --- | --- |
| `searchTickets` | Search tickets with query text, filters, sort, and limit. Backed primarily by Elasticsearch-compatible search. |
| `semanticSearchTickets` | Find semantically similar tickets using vector search. |
| `getTicketById` | Fetch canonical ticket details from DynamoDB. |
| `getTicketsByIds` | Hydrate a bounded list of candidate tickets from DynamoDB. |
| `getTicketStats` | Return simple aggregate counts for explainable summaries if needed. |

### DynamoDB

- Canonical store for support ticket records.
- Holds structured fields and free-text fields.
- Used for authoritative reads after search candidates are selected.

### Elasticsearch-Compatible Search

- Primary retrieval layer.
- Handles keyword search, metadata filters, time-window filters, sorting, and pagination.
- Should be optimized before relying on the LLM.

### Vector Database

- Stores embeddings for ticket title, description, symptoms, and resolution text.
- Supports semantic matches where exact keywords are missing.
- Should be implemented through an adapter so local and AWS options can differ.

Initial local option: Qdrant or another containerized vector database.

AWS option: Qdrant on EKS, OpenSearch vector capabilities, or another managed vector service. Final AWS choice can be made during the deployment milestone.

### AWS Bedrock

- Performs only bounded inference over candidate tickets.
- Responsibilities:
  - Rerank candidate tickets when free-text meaning matters.
  - Infer whether a ticket matches the user's intent.
  - Summarize selected ticket content.
  - Generate the final answer using citations.
- Must not receive full database dumps.
- Must not receive credentials or direct tool access.

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

For the MVP, Elasticsearch-compatible search can own most filtered retrieval, so DynamoDB secondary indexes can stay minimal until needed.

## 10. Indexing Model

Ticket data should be synchronized from DynamoDB into:

- Elasticsearch-compatible index for lexical search and filters.
- Vector database for semantic search.

Initial implementation can use a deterministic seed/index script.

Later implementation can add an indexer worker:

```text
DynamoDB stream or polling job
  -> normalize ticket document
  -> update Elasticsearch-compatible index
  -> generate embedding
  -> update vector database
```

For initial local scale, eventual consistency is acceptable if the UI or logs make indexing state clear.

## 11. Query Flow

### Single-Ticket Request

Example: "Give me the latest ticket about Lambda timeouts."

Expected flow:

1. Orchestrator detects likely single-ticket intent and recency requirement.
2. Orchestrator extracts filters: service `lambda`, topic `timeouts`, sort `createdAt desc`, limit candidate count.
3. MCP `searchTickets` retrieves top lexical matches from Elasticsearch-compatible search.
4. MCP `semanticSearchTickets` retrieves semantic matches for "Lambda timeouts."
5. Orchestrator merges and deduplicates candidates.
6. MCP `getTicketsByIds` hydrates canonical records from DynamoDB.
7. Bedrock reranks or validates the small candidate set.
8. API returns the top ticket with a short explanation and ticket citation.

### Multi-Ticket Request

Example: "Give me all Lambda timeout tickets from last week."

Expected flow:

1. Orchestrator detects multi-ticket intent.
2. Orchestrator extracts date range for last week, service `lambda`, and topic `timeouts`.
3. MCP `searchTickets` retrieves matching records using filters and lexical query.
4. MCP `semanticSearchTickets` may add semantic matches if lexical results are weak.
5. Orchestrator merges and applies result limits.
6. Bedrock summarizes common themes across the bounded result set.
7. API returns a list of tickets plus a short summary.

## 12. LLM Security Requirements

Ticket text is untrusted input. The system must defend against prompt injection and accidental tool misuse.

Requirements:

- Bedrock receives candidate snippets, not direct database access.
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
| Generated answer with Bedrock | p95 under 5 seconds, excluding cold starts and external provider incidents. |
| Local MVP throughput | 5 requests per second sustained for simple retrieval paths. |
| Candidate set sent to Bedrock | Default max 10 tickets unless explicitly changed. |
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
- Bedrock latency and token usage.
- Elasticsearch-compatible search latency.
- Vector search latency.
- DynamoDB read latency.
- Percentage of answers with citations.
- User feedback rating if added later.

The evaluation should make tradeoffs visible:

- Keyword-only vs vector-only vs hybrid retrieval.
- Search-only answer vs Bedrock-generated answer.
- Larger candidate set vs latency and token cost.

## 15. Observability

Every request should have a correlation ID.

Logs should capture:

- Request ID.
- Parsed filters.
- Search strategy used.
- Candidate counts from lexical and vector search.
- Final ticket IDs used in the answer.
- Bedrock latency and token counts if available.
- Error category without exposing secrets.

Metrics should capture:

- API p50/p95 latency.
- MCP tool latency.
- Elasticsearch-compatible search latency.
- Vector search latency.
- DynamoDB latency.
- Bedrock latency.
- Bedrock token usage and estimated cost.
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
- Elasticsearch-compatible container.
- Vector database container.
- Seed/index scripts.

Bedrock local behavior:

- If AWS credentials are configured, the API can call real Bedrock.
- If not configured, use a deterministic mock LLM adapter for local development and tests.

### AWS Deployment

Use Terraform for infrastructure.

Target AWS shape:

- EKS for containerized app workloads.
- ECR for images.
- DynamoDB for ticket store.
- Amazon OpenSearch Service or an Elasticsearch-compatible deployment for search.
- Vector database deployment chosen during AWS milestone.
- AWS Bedrock for hosted LLM inference.
- IAM roles for service accounts where applicable.
- CloudWatch for logs and metrics.

AWS SSO CLI configuration is assumed to be completed later before deployment work.

## 17. Model Serving And Compression Discussion

MVP uses Bedrock, so model compression and GPU serving are not implemented initially.

The architecture should still document these production tradeoffs:

- Bedrock reduces operational burden but limits low-level model optimization.
- Self-hosting could improve control over latency, cost, model choice, and data residency.
- ONNX Runtime can help optimize CPU inference for supported models.
- TensorRT is relevant for GPU-optimized inference.
- TorchServe is relevant for PyTorch model serving but adds operational overhead.
- Quantization can reduce memory and latency, often with some accuracy risk.
- Distillation can produce a smaller task-specific model, but requires training/evaluation effort.
- CPU serving may be cheaper and simpler for small models or low throughput.
- GPU serving may be justified for high throughput, larger models, or strict latency goals.

Future feature: add a self-hosted inference path behind the same LLM adapter used by Bedrock.

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

### Milestone 2: Ticket Data And Indexing

Deliverables:

- DynamoDB local table or equivalent.
- Seed support-ticket dataset with hundreds of records.
- Elasticsearch-compatible index schema.
- Vector database collection schema.
- Seed/index script.

Acceptance criteria:

- Seed command creates tickets and indexes them.
- Search index contains structured fields and free-text fields.
- Vector database contains embeddings or deterministic mock embeddings for local testing.

### Milestone 3: MCP Data Tools

Deliverables:

- `searchTickets` MCP tool.
- `semanticSearchTickets` MCP tool.
- `getTicketById` MCP tool.
- `getTicketsByIds` MCP tool.
- Tool input validation and bounded result limits.

Acceptance criteria:

- MCP tools can retrieve tickets through search and DynamoDB.
- Tools reject malformed inputs.
- Tools enforce default and maximum limits.

### Milestone 4: Hybrid Retrieval Orchestration

Deliverables:

- Query planning in the Chat API.
- Lexical and vector candidate retrieval.
- Candidate merge, dedupe, and rank logic.
- Single-ticket and multi-ticket handling.

Acceptance criteria:

- "Give me the latest ticket about Lambda timeouts" returns one cited ticket.
- "Give me all Lambda timeout tickets from last week" returns a bounded list.
- Retrieval works without Bedrock using search-only mode.

### Milestone 5: Bedrock Inference Integration

Deliverables:

- LLM adapter interface.
- Bedrock adapter.
- Mock LLM adapter for local/test mode.
- Prompt templates for bounded candidate reranking and answer generation.
- Prompt-injection guardrails.

Acceptance criteria:

- Bedrock receives only bounded candidate snippets.
- Generated answers cite ticket IDs.
- System can run locally with mock LLM if AWS credentials are unavailable.

### Milestone 6: Evaluation And Observability

Deliverables:

- Evaluation query set.
- Retrieval metrics script.
- Structured logs with request IDs.
- Basic latency metrics.
- Optional user feedback capture.

Acceptance criteria:

- Evaluation can compare keyword-only, vector-only, and hybrid retrieval.
- Logs show search strategy, candidate counts, and final cited ticket IDs.
- Latency can be measured per component.

### Milestone 7: Terraform And AWS EKS Deployment

Deliverables:

- Terraform modules or stacks for required AWS resources.
- ECR repositories.
- EKS deployment manifests or Helm chart.
- DynamoDB table.
- Search service or deployment.
- Vector DB AWS deployment choice.
- Bedrock IAM permissions.
- CloudWatch logging.

Acceptance criteria:

- AWS deployment can be planned with Terraform.
- After AWS SSO configuration, the stack can be deployed to a selected AWS account and region.
- App services run in EKS and can reach AWS backing services through least-privilege credentials.

### Milestone 8: Self-Hosted Inference Exploration

Deliverables:

- Architecture note comparing Bedrock with self-hosted inference.
- Optional LLM adapter implementation for a local or self-hosted model.
- Notes on ONNX Runtime, TensorRT, TorchServe, quantization, and distillation.

Acceptance criteria:

- Tradeoffs are documented clearly enough to guide future implementation decisions.
- No production dependency on self-hosted inference is required for MVP.

## 19. Milestone 0 Decisions And Remaining Open Decisions

Resolved in Milestone 0:

- Planned repo shape is a TypeScript monorepo with `apps`, `packages`, `infra`, `ops`, `scripts`, `data`, and `evals`.
- Initial package manager is npm.
- Planned UI framework is React with Vite.
- Planned API framework is Fastify.
- Planned MCP implementation uses the official TypeScript MCP SDK, with exact version pinned during implementation.
- Planned local vector database is Qdrant.
- Search remains behind an Elasticsearch-compatible adapter.
- Preferred AWS search target is Amazon OpenSearch Service.
- Bedrock remains the initial LLM provider, with a deterministic mock adapter for local/test mode.
- Lightweight auth is deferred unless it materially improves the product slice without distracting from retrieval and LLM security.
- Initial seed-ticket taxonomy covers common AWS support areas: Lambda, EKS, DynamoDB, IAM, API Gateway, S3, CloudWatch, and OpenSearch.

Remaining open decisions:

- AWS region.
- Bedrock model ID.
- Exact dependency versions.
- Exact local search container: OpenSearch or Elasticsearch.
- AWS vector deployment: Qdrant on EKS, OpenSearch vector capabilities, or another AWS-compatible option.

## 20. Definition Of Done For MVP

The MVP is done when:

- The local stack runs through containers.
- The UI can ask support-ticket questions.
- The API talks to data only through the MCP server.
- DynamoDB stores canonical ticket data.
- Elasticsearch-compatible search handles primary retrieval.
- Vector search contributes semantic candidates.
- Bedrock or mock LLM performs bounded inference over retrieved candidates.
- Responses include cited ticket IDs.
- Single-ticket and multi-ticket examples work.
- Basic evaluation and latency measurement exist.
- The architecture and tradeoffs are documented well enough to guide implementation and operations.
