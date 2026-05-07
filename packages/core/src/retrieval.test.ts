import { describe, expect, it } from "vitest";
import { createTicketEmbeddings } from "./embeddings.js";
import { searchTickets } from "./retrieval.js";
import { createSeedTickets } from "./seed.js";

describe("local ticket retrieval", () => {
  const tickets = createSeedTickets();
  const embeddings = createTicketEmbeddings(tickets);

  it("creates a hundreds-scale deterministic seed set", () => {
    expect(tickets).toHaveLength(240);
    expect(new Set(tickets.map((ticket) => ticket.ticketId)).size).toBe(tickets.length);
    expect(tickets.some((ticket) => ticket.status === "closed")).toBe(true);
  });

  it("returns the latest Lambda timeout ticket for the default query", () => {
    const response = searchTickets(
      {
        query: "Give me the latest ticket about Lambda timeouts",
        limit: 3
      },
      tickets,
      embeddings
    );

    expect(response.sort).toBe("createdAt_desc");
    expect(response.results[0]?.ticket.ticketId).toBe("TCK-0001");
    expect(response.results[0]?.matchReasons).toContain("title:lambda");
  });

  it("does not keep weak vector-only matches for specific operational queries", () => {
    const response = searchTickets(
      {
        query: "Give me the latest ticket about Lambda timeouts",
        limit: 5
      },
      tickets,
      embeddings
    );

    expect(response.results.every((result) => result.matchReasons[0] !== "vector:deterministic_embedding")).toBe(
      true
    );
  });

  it("enforces structured filters before scoring", () => {
    const response = searchTickets(
      {
        query: "deployment permission issue",
        filters: {
          services: ["iam"],
          environments: ["stage"]
        },
        limit: 5
      },
      tickets,
      embeddings
    );

    expect(response.results.length).toBeGreaterThan(0);
    expect(response.results.every((result) => result.ticket.service === "iam")).toBe(true);
    expect(response.results.every((result) => result.ticket.environment === "stage")).toBe(true);
  });

  it("caps excessive limits", () => {
    const response = searchTickets(
      {
        query: "latency",
        limit: 99
      },
      tickets,
      embeddings
    );

    expect(response.limit).toBe(10);
    expect(response.results.length).toBeLessThanOrEqual(10);
  });
});
