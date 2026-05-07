import { pathToFileURL } from "node:url";
import { NodeStreamableHTTPServerTransport } from "@modelcontextprotocol/node";
import { McpServer } from "@modelcontextprotocol/server";
import {
  MAX_SEARCH_LIMIT,
  TICKET_ENVIRONMENTS,
  TICKET_PRIORITIES,
  TICKET_SERVICES,
  TICKET_SORTS,
  TICKET_STATUSES,
  getTicketById,
  getTicketsByIds,
  semanticSearchTickets,
  searchTickets,
  type SupportTicket,
  type TicketLookupRequest,
  type TicketSearchRequest,
  type TicketSearchResponse,
  type TicketsLookupRequest
} from "@support-ticket-llm/core";
import Fastify from "fastify";
import * as z from "zod/v4";

const DEFAULT_HOST = "0.0.0.0";
const DEFAULT_PORT = 4001;

type HealthCheckResult = {
  service: string;
  status: "ok";
  timestamp: string;
};

type McpServerOptions = {
  logger?: boolean;
};

const searchTicketsInputSchema = z.object({
  query: z.string().min(1),
  filters: z
    .object({
      services: z.array(z.enum(TICKET_SERVICES)).optional(),
      environments: z.array(z.enum(TICKET_ENVIRONMENTS)).optional(),
      statuses: z.array(z.enum(TICKET_STATUSES)).optional(),
      priorities: z.array(z.enum(TICKET_PRIORITIES)).optional(),
      assignedTeams: z.array(z.string().min(1)).optional(),
      createdAfter: z.string().datetime().optional(),
      createdBefore: z.string().datetime().optional()
    })
    .optional(),
  limit: z.number().int().min(1).max(MAX_SEARCH_LIMIT).optional(),
  sort: z.enum(TICKET_SORTS).optional()
});

const ticketLookupInputSchema = z.object({
  ticketId: z.string().min(1)
});

const ticketsLookupInputSchema = z.object({
  ticketIds: z.array(z.string().min(1)).min(1).max(MAX_SEARCH_LIMIT)
});

export function createHealthCheckResult(): HealthCheckResult {
  return {
    service: "mcp-server",
    status: "ok",
    timestamp: new Date().toISOString()
  };
}

export function createSearchTicketsResult(request: TicketSearchRequest): TicketSearchResponse {
  return searchTickets(request);
}

export function createSemanticSearchTicketsResult(
  request: TicketSearchRequest
): TicketSearchResponse {
  return semanticSearchTickets(request);
}

export function createGetTicketByIdResult(request: TicketLookupRequest): SupportTicket | null {
  return getTicketById(request);
}

export function createGetTicketsByIdsResult(request: TicketsLookupRequest): SupportTicket[] {
  return getTicketsByIds(request);
}

export function createProtocolServer() {
  const server = new McpServer({
    name: "support-ticket-mcp-server",
    version: "0.1.0"
  });

  server.registerTool(
    "healthCheck",
    {
      description: "Return MCP server health for local orchestration checks.",
      inputSchema: z.object({})
    },
    async () => ({
      content: [
        {
          type: "text",
          text: JSON.stringify(createHealthCheckResult())
        }
      ]
    })
  );

  server.registerTool(
    "searchTickets",
    {
      description:
        "Search local support tickets with bounded lexical and deterministic vector retrieval.",
      inputSchema: searchTicketsInputSchema
    },
    async (input) => ({
      content: [
        {
          type: "text",
          text: JSON.stringify(
            createSearchTicketsResult(searchTicketsInputSchema.parse(input))
          )
        }
      ]
    })
  );

  server.registerTool(
    "semanticSearchTickets",
    {
      description:
        "Search local support tickets using deterministic vector similarity only.",
      inputSchema: searchTicketsInputSchema
    },
    async (input) => ({
      content: [
        {
          type: "text",
          text: JSON.stringify(
            createSemanticSearchTicketsResult(searchTicketsInputSchema.parse(input))
          )
        }
      ]
    })
  );

  server.registerTool(
    "getTicketById",
    {
      description: "Fetch one canonical support ticket by ticketId.",
      inputSchema: ticketLookupInputSchema
    },
    async (input) => ({
      content: [
        {
          type: "text",
          text: JSON.stringify(createGetTicketByIdResult(ticketLookupInputSchema.parse(input)))
        }
      ]
    })
  );

  server.registerTool(
    "getTicketsByIds",
    {
      description: "Fetch canonical support tickets by a bounded list of ticketIds.",
      inputSchema: ticketsLookupInputSchema
    },
    async (input) => ({
      content: [
        {
          type: "text",
          text: JSON.stringify(createGetTicketsByIdsResult(ticketsLookupInputSchema.parse(input)))
        }
      ]
    })
  );

  return server;
}

export function buildServer(options: McpServerOptions = {}) {
  const app = Fastify({ logger: options.logger ?? true });
  const protocolServer = createProtocolServer();

  app.get("/health", async () => createHealthCheckResult());

  app.post("/mcp", async (request, reply) => {
    const transport = new NodeStreamableHTTPServerTransport({
      sessionIdGenerator: undefined
    });

    reply.raw.on("close", () => {
      void transport.close();
    });

    await protocolServer.connect(transport);
    reply.hijack();
    await transport.handleRequest(request.raw, reply.raw, request.body);
  });

  return app;
}

export async function startServer() {
  const app = buildServer();
  const host = process.env.MCP_HOST ?? DEFAULT_HOST;
  const port = Number.parseInt(process.env.MCP_PORT ?? `${DEFAULT_PORT}`, 10);

  await app.listen({ host, port });
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  startServer().catch((error) => {
    console.error(error);
    process.exit(1);
  });
}
