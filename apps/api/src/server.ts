import { pathToFileURL } from "node:url";
import { Client, StreamableHTTPClientTransport } from "@modelcontextprotocol/client";
import {
  createDeterministicInferenceAdapter,
  createLambdaHttpInferenceAdapter,
  UNSAFE_CITATION_FALLBACK_ANSWER,
  type GenerateTicketAnswerResponse,
  type InferenceAdapter
} from "@support-ticket-llm/adapters";
import type {
  QueryPlan,
  SupportTicket,
  TicketSearchRequest,
  TicketSearchResponse,
  TicketSearchResult
} from "@support-ticket-llm/core";
import {
  hydrateTicketSearchResults,
  mergeTicketSearchResults,
  planTicketQuery
} from "@support-ticket-llm/core";
import Fastify from "fastify";

const DEFAULT_HOST = "0.0.0.0";
const DEFAULT_PORT = 4000;
const DEFAULT_MCP_SERVER_URL = "http://localhost:4001/mcp";

type TextContent = {
  type: "text";
  text: string;
};

type HealthCheckResult = {
  service: string;
  status: "ok";
  timestamp: string;
};

type ChatRequest = {
  message?: unknown;
};

type ChatCitation = {
  ticketId: string;
  title: string;
  service: string;
  environment: string;
  status: string;
  priority: string;
  createdAt: string;
  score: number;
  matchReasons: string[];
};

type RetrievalDiagnostics = {
  totalTickets: number;
  filteredTickets: number;
  returnedTickets: number;
  strategy: string;
  lexicalCandidateCount?: number;
  semanticCandidateCount?: number;
  hydratedTicketCount?: number;
};

type ApiMcpClient = {
  healthCheck: () => Promise<HealthCheckResult>;
  searchTickets: (request: TicketSearchRequest) => Promise<TicketSearchResponse>;
  semanticSearchTickets: (request: TicketSearchRequest) => Promise<TicketSearchResponse>;
  getTicketsByIds: (request: { ticketIds: string[] }) => Promise<SupportTicket[]>;
};

type ApiServerOptions = {
  logger?: boolean;
  inferenceAdapter?: InferenceAdapter;
  mcpClient?: ApiMcpClient;
  mcpServerUrl?: string;
};

type InferenceProvider = "deterministic_mock" | "aws_lambda_http";

function isTextContent(value: unknown): value is TextContent {
  return (
    typeof value === "object" &&
    value !== null &&
    "type" in value &&
    value.type === "text" &&
    "text" in value &&
    typeof value.text === "string"
  );
}

async function callMcpJsonTool<TResponse>(
  mcpServerUrl: string,
  name: string,
  args: Record<string, unknown>
): Promise<TResponse> {
  const client = new Client({ name: "support-ticket-api", version: "0.1.0" });
  const transport = new StreamableHTTPClientTransport(new URL(mcpServerUrl));

  try {
    await client.connect(transport);
    const result = await client.callTool({
      name,
      arguments: args
    });

    const firstText = result.content.find(isTextContent);
    if (!firstText) {
      throw new Error(`MCP ${name} returned no text content`);
    }

    return JSON.parse(firstText.text) as TResponse;
  } finally {
    await client.close();
  }
}

export async function callMcpHealthCheck(mcpServerUrl: string): Promise<HealthCheckResult> {
  return callMcpJsonTool<HealthCheckResult>(mcpServerUrl, "healthCheck", {});
}

export async function callMcpSearchTickets(
  mcpServerUrl: string,
  request: TicketSearchRequest
): Promise<TicketSearchResponse> {
  return callMcpJsonTool<TicketSearchResponse>(
    mcpServerUrl,
    "searchTickets",
    request as Record<string, unknown>
  );
}

export async function callMcpSemanticSearchTickets(
  mcpServerUrl: string,
  request: TicketSearchRequest
): Promise<TicketSearchResponse> {
  return callMcpJsonTool<TicketSearchResponse>(
    mcpServerUrl,
    "semanticSearchTickets",
    request as Record<string, unknown>
  );
}

export async function callMcpGetTicketsByIds(
  mcpServerUrl: string,
  request: { ticketIds: string[] }
): Promise<SupportTicket[]> {
  return callMcpJsonTool<SupportTicket[]>(
    mcpServerUrl,
    "getTicketsByIds",
    request
  );
}

function createHttpMcpClient(mcpServerUrl: string): ApiMcpClient {
  return {
    healthCheck: () => callMcpHealthCheck(mcpServerUrl),
    searchTickets: (request) => callMcpSearchTickets(mcpServerUrl, request),
    semanticSearchTickets: (request) => callMcpSemanticSearchTickets(mcpServerUrl, request),
    getTicketsByIds: (request) => callMcpGetTicketsByIds(mcpServerUrl, request)
  };
}

function parseOptionalPositiveInteger(
  name: string,
  value: string | undefined
): number | undefined {
  const normalized = value?.trim();
  if (!normalized) {
    return undefined;
  }

  if (!/^\d+$/.test(normalized)) {
    throw new Error(`${name} must be a positive integer`);
  }

  const parsed = Number.parseInt(normalized, 10);
  if (parsed <= 0) {
    throw new Error(`${name} must be a positive integer`);
  }

  return parsed;
}

function parseInferenceProvider(value: string | undefined): InferenceProvider {
  const provider = value?.trim() || "deterministic_mock";
  if (provider === "deterministic_mock" || provider === "aws_lambda_http") {
    return provider;
  }

  throw new Error(`Unsupported INFERENCE_PROVIDER: ${provider}`);
}

function optionalTrimmed(value: string | undefined): string | undefined {
  const normalized = value?.trim();
  return normalized ? normalized : undefined;
}

export function createConfiguredInferenceAdapter(
  env: Record<string, string | undefined> = process.env
): InferenceAdapter {
  const provider = parseInferenceProvider(env.INFERENCE_PROVIDER);

  if (provider === "deterministic_mock") {
    return createDeterministicInferenceAdapter();
  }

  const endpointUrl = optionalTrimmed(env.INFERENCE_LAMBDA_URL);
  if (!endpointUrl) {
    throw new Error(
      "INFERENCE_LAMBDA_URL is required when INFERENCE_PROVIDER=aws_lambda_http"
    );
  }

  return createLambdaHttpInferenceAdapter({
    endpointUrl,
    apiKey: optionalTrimmed(env.INFERENCE_LAMBDA_API_KEY),
    maxCandidates: parseOptionalPositiveInteger(
      "INFERENCE_MAX_CANDIDATES",
      env.INFERENCE_MAX_CANDIDATES
    ),
    maxGeneratedTokens: parseOptionalPositiveInteger(
      "INFERENCE_MAX_GENERATED_TOKENS",
      env.INFERENCE_MAX_GENERATED_TOKENS
    ),
    maxSnippetCharacters: parseOptionalPositiveInteger(
      "INFERENCE_MAX_SNIPPET_CHARACTERS",
      env.INFERENCE_MAX_SNIPPET_CHARACTERS
    ),
    requestTimeoutMs: parseOptionalPositiveInteger(
      "INFERENCE_REQUEST_TIMEOUT_MS",
      env.INFERENCE_REQUEST_TIMEOUT_MS
    )
  });
}

function toCitation(result: TicketSearchResult): ChatCitation {
  return {
    ticketId: result.ticket.ticketId,
    title: result.ticket.title,
    service: result.ticket.service,
    environment: result.ticket.environment,
    status: result.ticket.status,
    priority: result.ticket.priority,
    createdAt: result.ticket.createdAt,
    score: result.score,
    matchReasons: result.matchReasons
  };
}

function toSafeInferenceResult(inference: GenerateTicketAnswerResponse): {
  answer: string;
  citedTicketIds: string[];
  unsafeAnswerWithheld: boolean;
} {
  if (inference.diagnostics.citationValidation !== "failed") {
    return {
      answer: inference.answer,
      citedTicketIds: inference.citedTicketIds,
      unsafeAnswerWithheld: false
    };
  }

  return {
    answer: UNSAFE_CITATION_FALLBACK_ANSWER,
    citedTicketIds: [],
    unsafeAnswerWithheld: true
  };
}

async function runPlannedRetrieval(
  message: string,
  mcpClient: ApiMcpClient
): Promise<{
  plan: QueryPlan;
  results: TicketSearchResult[];
  diagnostics: RetrievalDiagnostics;
}> {
  const plan = planTicketQuery(message);
  const request = {
    query: plan.retrievalQuery,
    filters: plan.filters,
    limit: plan.limit,
    sort: plan.sort
  };
  const lexicalSearch = await mcpClient.searchTickets(request);
  const semanticSearch = plan.useSemanticSearch
    ? await mcpClient.semanticSearchTickets(request)
    : {
        ...lexicalSearch,
        results: [],
        diagnostics: {
          ...lexicalSearch.diagnostics,
          returnedTickets: 0,
          strategy: "deterministic_vector"
        }
      };
  const mergedResults = mergeTicketSearchResults(
    lexicalSearch.results,
    semanticSearch.results,
    plan.limit,
    plan.sort
  );
  const hydratedTickets = await mcpClient.getTicketsByIds({
    ticketIds: mergedResults.map((result) => result.ticket.ticketId)
  });
  const hydratedResults = hydrateTicketSearchResults(mergedResults, hydratedTickets);

  return {
    plan: {
      ...plan,
      candidateTicketIds: hydratedResults.map((result) => result.ticket.ticketId)
    },
    results: hydratedResults,
    diagnostics: {
      totalTickets: lexicalSearch.diagnostics.totalTickets,
      filteredTickets: lexicalSearch.diagnostics.filteredTickets,
      returnedTickets: hydratedResults.length,
      strategy: "merged_candidates",
      lexicalCandidateCount: lexicalSearch.results.length,
      semanticCandidateCount: semanticSearch.results.length,
      hydratedTicketCount: hydratedTickets.length
    }
  };
}

export function buildServer(options: ApiServerOptions = {}) {
  const app = Fastify({ logger: options.logger ?? true });
  const mcpServerUrl =
    options.mcpServerUrl ?? process.env.MCP_SERVER_URL ?? DEFAULT_MCP_SERVER_URL;
  const mcpClient = options.mcpClient ?? createHttpMcpClient(mcpServerUrl);
  const inferenceAdapter = options.inferenceAdapter ?? createConfiguredInferenceAdapter();

  app.get("/health", async () => ({
    service: "api",
    status: "ok",
    timestamp: new Date().toISOString()
  }));

  app.get("/health/deep", async () => {
    const mcp = await mcpClient.healthCheck();

    return {
      service: "api",
      status: "ok",
      timestamp: new Date().toISOString(),
      dependencies: {
        mcp
      }
    };
  });

  app.post<{ Body: ChatRequest }>("/chat", async (request) => {
    const message =
      typeof request.body?.message === "string" ? request.body.message.trim() : "";

    if (!message) {
      return {
        status: "error",
        error: "message is required"
      };
    }

    const retrieval = await runPlannedRetrieval(message, mcpClient);
    const inference = await inferenceAdapter.generateTicketAnswer({
      message,
      candidates: retrieval.results
    });
    const safeInference = toSafeInferenceResult(inference);
    const citedTicketIdSet = new Set(safeInference.citedTicketIds);
    const citedResults =
      safeInference.citedTicketIds.length > 0
        ? retrieval.results.filter((result) => citedTicketIdSet.has(result.ticket.ticketId))
        : [];

    return {
      status: "ok",
      answer: safeInference.answer,
      request: {
        message
      },
      citations: citedResults.map(toCitation),
      diagnostics: {
        plan: retrieval.plan,
        retrieval: retrieval.diagnostics,
        inference: {
          ...inference.diagnostics,
          citedTicketIds: safeInference.citedTicketIds,
          unsafeAnswerWithheld: safeInference.unsafeAnswerWithheld
        }
      }
    };
  });

  return app;
}

export async function startServer() {
  const app = buildServer();
  const host = process.env.API_HOST ?? DEFAULT_HOST;
  const port = Number.parseInt(process.env.API_PORT ?? `${DEFAULT_PORT}`, 10);

  await app.listen({ host, port });
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  startServer().catch((error) => {
    console.error(error);
    process.exit(1);
  });
}
