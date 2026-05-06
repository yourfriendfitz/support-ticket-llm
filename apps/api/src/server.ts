import { pathToFileURL } from "node:url";
import { Client, StreamableHTTPClientTransport } from "@modelcontextprotocol/client";
import type {
  TicketSearchRequest,
  TicketSearchResponse,
  TicketSearchResult
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

type ApiMcpClient = {
  healthCheck: () => Promise<HealthCheckResult>;
  searchTickets: (request: TicketSearchRequest) => Promise<TicketSearchResponse>;
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

function createHttpMcpClient(mcpServerUrl: string): ApiMcpClient {
  return {
    healthCheck: () => callMcpHealthCheck(mcpServerUrl),
    searchTickets: (request) => callMcpSearchTickets(mcpServerUrl, request)
  };
}

function toCitation(result: TicketSearchResult): ChatCitation {
  return {
    ticketId: result.ticket.id,
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

function buildRetrievalAnswer(searchResponse: TicketSearchResponse): string {
  const [topResult] = searchResponse.results;

  if (!topResult) {
    return "No matching tickets were found. Tiny-model inference is not active yet, so this response only reflects local retrieval.";
  }

  return [
    `Found ${searchResponse.results.length} matching ticket${searchResponse.results.length === 1 ? "" : "s"}.`,
    `Top match is ${topResult.ticket.id}: ${topResult.ticket.title}.`,
    "Tiny-model inference is not active yet; this response is retrieval-only."
  ].join(" ");
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

    const searchResponse = await mcpClient.searchTickets({
      query: message,
      limit: 5
    });

    return {
      status: "ok",
      answer: buildRetrievalAnswer(searchResponse),
      request: {
        message
      },
      citations: searchResponse.results.map(toCitation),
      diagnostics: {
        retrieval: searchResponse.diagnostics
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
