import { describe, expect, it } from "vitest";
import { getTicketsByIds, searchTickets, semanticSearchTickets } from "@support-ticket-llm/core";
import { buildServer, createConfiguredInferenceAdapter } from "./server.js";

const healthyMcp = {
  service: "mcp-server",
  status: "ok" as const,
  timestamp: "2026-05-06T00:00:00.000Z"
};

describe("api server", () => {
  it("defaults to deterministic mock inference when no provider env is set", async () => {
    const adapter = createConfiguredInferenceAdapter({});

    const response = await adapter.generateTicketAnswer({
      message: "Find a ticket that does not exist",
      candidates: []
    });

    expect(response.diagnostics.adapter).toBe("deterministic_mock");
  });

  it("requires a Lambda URL when Lambda HTTP inference is configured", () => {
    expect(() =>
      createConfiguredInferenceAdapter({
        INFERENCE_PROVIDER: "aws_lambda_http"
      })
    ).toThrow("INFERENCE_LAMBDA_URL is required");
  });

  it("rejects unsupported inference providers", () => {
    expect(() =>
      createConfiguredInferenceAdapter({
        INFERENCE_PROVIDER: "bedrock"
      })
    ).toThrow("Unsupported INFERENCE_PROVIDER");
  });

  it("rejects malformed inference limit env vars", () => {
    expect(() =>
      createConfiguredInferenceAdapter({
        INFERENCE_PROVIDER: "aws_lambda_http",
        INFERENCE_LAMBDA_URL: "https://example.invalid/infer",
        INFERENCE_MAX_GENERATED_TOKENS: "10.5"
      })
    ).toThrow("INFERENCE_MAX_GENERATED_TOKENS must be a positive integer");
  });

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
        searchTickets: async (request) => searchTickets(request),
        semanticSearchTickets: async (request) => semanticSearchTickets(request),
        getTicketsByIds: async (request) => getTicketsByIds(request)
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
    expect(body.answer).toContain("TCK-0001");
    expect(body.citations[0]).toMatchObject({
      ticketId: "TCK-0001",
      service: "lambda",
      priority: "critical"
    });
    expect(body.diagnostics.retrieval.strategy).toBe("merged_candidates");
    expect(body.diagnostics.inference.adapter).toBe("deterministic_mock");
    expect(body.diagnostics.inference.citationValidation).toBe("passed");
    expect(body.diagnostics.plan.candidateTicketIds[0]).toBe("TCK-0001");
    expect(body.diagnostics.observability.requestId).toEqual(expect.any(String));
    expect(body.diagnostics.observability.componentLatencyMs).toMatchObject({
      retrieval: expect.any(Number),
      inference: expect.any(Number),
      total: expect.any(Number)
    });
    expect(body.diagnostics.observability.retrievalStrategy).toBe("merged_candidates");
    expect(body.diagnostics.observability.retrievalCandidateCounts.returned).toBe(
      body.citations.length
    );
    expect(body.diagnostics.observability.finalCitedTicketIds).toEqual(
      body.diagnostics.inference.citedTicketIds
    );
  });

  it("plans filters and bounded result counts for multi-ticket chat", async () => {
    const app = buildServer({
      logger: false,
      mcpClient: {
        healthCheck: async () => healthyMcp,
        searchTickets: async (request) => searchTickets(request),
        semanticSearchTickets: async (request) => semanticSearchTickets(request),
        getTicketsByIds: async (request) => getTicketsByIds(request)
      }
    });

    const response = await app.inject({
      method: "POST",
      url: "/chat",
      payload: {
        message: "Give me all Lambda timeout tickets from last week"
      }
    });

    expect(response.statusCode).toBe(200);
    const body = response.json();
    expect(body.status).toBe("ok");
    expect(body.diagnostics.plan.filters.services).toEqual(["lambda"]);
    expect(body.diagnostics.plan.filters.createdAfter).toBe("2026-04-30T12:00:00.000Z");
    expect(body.diagnostics.plan.limit).toBe(10);
    expect(body.diagnostics.inference.promptCandidateCount).toBe(body.citations.length);
    expect(body.citations.length).toBeGreaterThanOrEqual(2);
    expect(body.citations.every((citation: { service: string }) => citation.service === "lambda")).toBe(
      true
    );
  });

  it("plans status filters before chat retrieval", async () => {
    const app = buildServer({
      logger: false,
      mcpClient: {
        healthCheck: async () => healthyMcp,
        searchTickets: async (request) => searchTickets(request),
        semanticSearchTickets: async (request) => semanticSearchTickets(request),
        getTicketsByIds: async (request) => getTicketsByIds(request)
      }
    });

    const response = await app.inject({
      method: "POST",
      url: "/chat",
      payload: {
        message: "Which closed Lambda tickets are recent?"
      }
    });

    expect(response.statusCode).toBe(200);
    const body = response.json();
    expect(body.status).toBe("ok");
    expect(body.diagnostics.plan.filters.services).toEqual(["lambda"]);
    expect(body.diagnostics.plan.filters.statuses).toEqual(["closed"]);
    expect(body.diagnostics.inference.citedTicketIds).toEqual(
      body.citations.map((citation: { ticketId: string }) => citation.ticketId)
    );
    expect(body.citations.length).toBeGreaterThan(0);
    expect(
      body.citations.every(
        (citation: { service: string; status: string }) =>
          citation.service === "lambda" && citation.status === "closed"
      )
    ).toBe(true);
  });

  it("withholds inference answers when citation validation fails", async () => {
    const app = buildServer({
      logger: false,
      mcpClient: {
        healthCheck: async () => healthyMcp,
        searchTickets: async (request) => searchTickets(request),
        semanticSearchTickets: async (request) => semanticSearchTickets(request),
        getTicketsByIds: async (request) => getTicketsByIds(request)
      },
      inferenceAdapter: {
        generateTicketAnswer: async (request) => ({
          answer: "Unsafe generated answer cites TCK-9999.",
          citedTicketIds: ["TCK-9999"],
          prompt: {
            templateVersion: "test",
            system: "",
            user: "",
            candidateSnippets: []
          },
          diagnostics: {
            adapter: "aws_lambda_http",
            templateVersion: "test",
            requestedCandidateCount: request.candidates.length,
            promptCandidateCount: request.candidates.length,
            maxSnippetCharacters: 480,
            citationValidation: "failed",
            guardrails: []
          }
        })
      }
    });

    const response = await app.inject({
      method: "POST",
      url: "/chat",
      payload: {
        message: "Give me all Lambda timeout tickets from last week"
      }
    });

    expect(response.statusCode).toBe(200);
    const body = response.json();
    expect(body.status).toBe("ok");
    expect(body.answer).toContain("cannot return it safely");
    expect(body.answer).not.toContain("TCK-9999");
    expect(body.citations).toEqual([]);
    expect(body.diagnostics.inference.citedTicketIds).toEqual([]);
    expect(body.diagnostics.inference.unsafeAnswerWithheld).toBe(true);
    expect(body.diagnostics.observability.finalCitedTicketIds).toEqual([]);
    expect(body.diagnostics.observability.componentLatencyMs.total).toEqual(expect.any(Number));
  });
});
