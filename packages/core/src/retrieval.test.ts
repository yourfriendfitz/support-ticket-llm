import { describe, expect, it } from "vitest";
import { createTicketEmbeddings } from "./embeddings.js";
import {
  getTicketById,
  getTicketsByIds,
  planAndSearchTickets,
  planTicketQuery,
  searchTickets,
  semanticSearchTickets
} from "./retrieval.js";
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

  it("hydrates tickets by canonical ticket IDs", () => {
    expect(getTicketById({ ticketId: "TCK-0001" }, tickets)?.title).toContain("Lambda");
    expect(
      getTicketsByIds({ ticketIds: ["TCK-0002", "TCK-0001", "TCK-0002", "missing"] }, tickets).map(
        (ticket) => ticket.ticketId
      )
    ).toEqual(["TCK-0002", "TCK-0001"]);
  });

  it("supports deterministic vector-only search", () => {
    const response = semanticSearchTickets(
      {
        query: "Lambda checkout worker times out under payment load",
        limit: 3
      },
      tickets,
      embeddings
    );

    expect(response.diagnostics.strategy).toBe("deterministic_vector");
    expect(response.results.length).toBeGreaterThan(0);
    expect(response.results.every((result) => result.lexicalScore === 0)).toBe(true);
  });

  it("plans service and last-week filters for multi-ticket requests", () => {
    const plan = planTicketQuery("Give me all Lambda timeout tickets from last week");

    expect(plan.filters.services).toEqual(["lambda"]);
    expect(plan.filters.createdAfter).toBe("2026-04-30T12:00:00.000Z");
    expect(plan.filters.createdBefore).toBe("2026-05-07T12:00:00.000Z");
    expect(plan.limit).toBe(10);
    expect(plan.sort).toBe("relevance");
  });

  it("merges lexical and semantic candidates then hydrates canonical tickets", () => {
    const response = planAndSearchTickets(
      "Give me all Lambda timeout tickets from last week",
      tickets,
      embeddings
    );

    expect(response.diagnostics.strategy).toBe("merged_candidates");
    expect(response.results.length).toBeGreaterThanOrEqual(2);
    expect(response.results.every((result) => result.ticket.service === "lambda")).toBe(true);
    expect(response.hydratedTickets.map((ticket) => ticket.ticketId)).toEqual(
      response.plan.candidateTicketIds
    );
  });
});
