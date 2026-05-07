import { describe, expect, it } from "vitest";
import {
  buildServer,
  createGetTicketByIdResult,
  createGetTicketsByIdsResult,
  createHealthCheckResult,
  createSearchTicketsResult,
  createSemanticSearchTicketsResult
} from "./server.js";

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

    expect(response.results[0]?.ticket.ticketId).toBe("TCK-0001");
    expect(response.diagnostics.strategy).toBe("hybrid_lexical_vector");
  });

  it("runs semantic ticket search", () => {
    const response = createSemanticSearchTicketsResult({
      query: "Lambda checkout worker times out under payment load",
      limit: 3
    });

    expect(response.diagnostics.strategy).toBe("deterministic_vector");
    expect(response.results.length).toBeGreaterThan(0);
  });

  it("hydrates canonical tickets by ID", () => {
    expect(createGetTicketByIdResult({ ticketId: "TCK-0001" })?.ticketId).toBe("TCK-0001");
    expect(
      createGetTicketsByIdsResult({ ticketIds: ["TCK-0002", "TCK-0001", "TCK-0002"] }).map(
        (ticket) => ticket.ticketId
      )
    ).toEqual(["TCK-0002", "TCK-0001"]);
  });
});
