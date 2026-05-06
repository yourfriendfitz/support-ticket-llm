import { pathToFileURL } from "node:url";
import { NodeStreamableHTTPServerTransport } from "@modelcontextprotocol/node";
import { McpServer } from "@modelcontextprotocol/server";
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

export function createHealthCheckResult(): HealthCheckResult {
  return {
    service: "mcp-server",
    status: "ok",
    timestamp: new Date().toISOString()
  };
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
