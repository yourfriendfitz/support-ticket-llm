import { describe, expect, it } from "vitest";
import { searchTickets } from "@support-ticket-llm/core";
import { buildServer } from "./server.js";

const healthyMcp = {
  service: "mcp-server",
  status: "ok" as const,
  timestamp: "2026-05-06T00:00:00.000Z"
};

describe("api server", () => {
  it("returns API health", async () => {
    const app = buildServer({ logger: false });

    const response = await app.inject({
      method: "GET",
      url: "/health"
    });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toMatchObject({
      service: "api",
      status: "ok"
    });
  });

  it("requires a chat message", async () => {
    const app = buildServer({ logger: false });

    const response = await app.inject({
      method: "POST",
      url: "/chat",
      payload: {}
    });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toMatchObject({
      status: "error",
      error: "message is required"
    });
  });

  it("returns cited retrieval results for chat", async () => {
    const app = buildServer({
      logger: false,
      mcpClient: {
        healthCheck: async () => healthyMcp,
        searchTickets: async (request) => searchTickets(request)
      }
    });

    const response = await app.inject({
      method: "POST",
      url: "/chat",
      payload: {
        message: "Give me the latest ticket about Lambda timeouts"
      }
    });

    expect(response.statusCode).toBe(200);
    const body = response.json();
    expect(body.status).toBe("ok");
    expect(body.citations[0]).toMatchObject({
      ticketId: "TCK-0001",
      service: "lambda",
      priority: "critical"
    });
    expect(body.diagnostics.retrieval.strategy).toBe("hybrid_lexical_vector");
  });
});
