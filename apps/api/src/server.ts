import { pathToFileURL } from "node:url";
import { Client, StreamableHTTPClientTransport } from "@modelcontextprotocol/client";
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
  mcpClient?: ApiMcpClient;
  mcpServerUrl?: string;
};

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

function buildRetrievalAnswer(results: readonly TicketSearchResult[]): string {
  const [topResult] = results;

  if (!topResult) {
    return "No matching tickets were found. Tiny-model inference is not active yet, so this response only reflects local retrieval.";
  }

  return [
    `Found ${results.length} matching ticket${results.length === 1 ? "" : "s"}.`,
    `Top match is ${topResult.ticket.ticketId}: ${topResult.ticket.title}.`,
    "Tiny-model inference is not active yet; this response is retrieval-only."
  ].join(" ");
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

    return {
      status: "ok",
      answer: buildRetrievalAnswer(retrieval.results),
      request: {
        message
      },
      citations: retrieval.results.map(toCitation),
      diagnostics: {
        plan: retrieval.plan,
        retrieval: retrieval.diagnostics
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
