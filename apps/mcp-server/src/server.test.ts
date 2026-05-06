import { describe, expect, it } from "vitest";
import { buildServer, createHealthCheckResult, createSearchTicketsResult } from "./server.js";

describe("mcp server", () => {
  it("returns HTTP health", async () => {
    const app = buildServer({ logger: false });

    const response = await app.inject({
      method: "GET",
      url: "/health"
    });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toMatchObject({
      service: "mcp-server",
      status: "ok"
    });
  });

  it("creates health check payloads", () => {
    expect(createHealthCheckResult()).toMatchObject({
      service: "mcp-server",
      status: "ok"
    });
  });

  it("searches local tickets", () => {
    const response = createSearchTicketsResult({
      query: "Give me the latest ticket about Lambda timeouts",
      limit: 3
    });

    expect(response.results[0]?.ticket.id).toBe("TCK-0001");
    expect(response.diagnostics.strategy).toBe("hybrid_lexical_vector");
  });
});
