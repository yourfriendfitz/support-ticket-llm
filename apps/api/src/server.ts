import { pathToFileURL } from "node:url";
import { Client, StreamableHTTPClientTransport } from "@modelcontextprotocol/client";
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

type ApiServerOptions = {
  logger?: boolean;
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

export async function callMcpHealthCheck(mcpServerUrl: string): Promise<HealthCheckResult> {
  const client = new Client({ name: "support-ticket-api", version: "0.1.0" });
  const transport = new StreamableHTTPClientTransport(new URL(mcpServerUrl));

  try {
    await client.connect(transport);
    const result = await client.callTool({
      name: "healthCheck",
      arguments: {}
    });

    const firstText = result.content.find(isTextContent);
    if (!firstText) {
      throw new Error("MCP healthCheck returned no text content");
    }

    return JSON.parse(firstText.text) as HealthCheckResult;
  } finally {
    await client.close();
  }
}

export function buildServer(options: ApiServerOptions = {}) {
  const app = Fastify({ logger: options.logger ?? true });
  const mcpServerUrl =
    options.mcpServerUrl ?? process.env.MCP_SERVER_URL ?? DEFAULT_MCP_SERVER_URL;

  app.get("/health", async () => ({
    service: "api",
    status: "ok",
    timestamp: new Date().toISOString()
  }));

  app.get("/health/deep", async () => {
    const mcp = await callMcpHealthCheck(mcpServerUrl);

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

    const mcp = await callMcpHealthCheck(mcpServerUrl);

    return {
      status: "ok",
      answer:
        "Chat orchestration is online. Ticket retrieval and tiny-model inference will be added in later milestones.",
      request: {
        message
      },
      citations: [],
      diagnostics: {
        mcp
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
