import {
  cosineSimilarity,
  createTicketEmbeddingText,
  createTicketEmbeddings,
  embedText,
  tokenize
} from "./embeddings.js";
import { createSeedTickets } from "./seed.js";
import type {
  SupportTicket,
  TicketEmbeddingRecord,
  TicketSearchFilters,
  TicketSearchRequest,
  TicketSearchResponse,
  TicketSearchResult,
  TicketSort
} from "./types.js";

export const DEFAULT_SEARCH_LIMIT = 5;
export const MAX_SEARCH_LIMIT = 10;

const stopwords = new Set([
  "a",
  "about",
  "after",
  "and",
  "for",
  "give",
  "in",
  "latest",
  "me",
  "newest",
  "of",
  "recent",
  "show",
  "the",
  "ticket",
  "tickets",
  "to",
  "with"
]);

const recencyTerms = new Set(["latest", "newest", "recent", "recently"]);

type ScoredTicket = TicketSearchResult & {
  createdAtMs: number;
};

function roundScore(value: number): number {
  return Number(value.toFixed(4));
}

function normalizeLimit(limit: number | undefined): number {
  if (limit === undefined || Number.isNaN(limit)) {
    return DEFAULT_SEARCH_LIMIT;
  }

  return Math.min(Math.max(Math.trunc(limit), 1), MAX_SEARCH_LIMIT);
}

function normalizeQueryTokens(query: string): string[] {
  return tokenize(query).filter((token) => !stopwords.has(token));
}

function inferSort(query: string, sort: TicketSort | undefined): TicketSort {
  if (sort) {
    return sort;
  }

  return tokenize(query).some((token) => recencyTerms.has(token)) ? "createdAt_desc" : "relevance";
}

function matchesOne<T extends string>(value: T, allowed: readonly T[] | undefined): boolean {
  return !allowed || allowed.length === 0 || allowed.includes(value);
}

function matchesString(value: string, allowed: readonly string[] | undefined): boolean {
  return (
    !allowed ||
    allowed.length === 0 ||
    allowed.some((allowedValue) => allowedValue.toLowerCase() === value.toLowerCase())
  );
}

function matchesDateRange(ticket: SupportTicket, filters: TicketSearchFilters): boolean {
  const createdAt = Date.parse(ticket.createdAt);
  const createdAfter = filters.createdAfter ? Date.parse(filters.createdAfter) : undefined;
  const createdBefore = filters.createdBefore ? Date.parse(filters.createdBefore) : undefined;

  if (createdAfter !== undefined && createdAt < createdAfter) {
    return false;
  }

  if (createdBefore !== undefined && createdAt > createdBefore) {
    return false;
  }

  return true;
}

function applyFilters(
  tickets: readonly SupportTicket[],
  filters: TicketSearchFilters
): SupportTicket[] {
  return tickets.filter(
    (ticket) =>
      matchesOne(ticket.service, filters.services) &&
      matchesOne(ticket.environment, filters.environments) &&
      matchesOne(ticket.status, filters.statuses) &&
      matchesOne(ticket.priority, filters.priorities) &&
      matchesString(ticket.assignedTeam, filters.assignedTeams) &&
      matchesDateRange(ticket, filters)
  );
}

function scoreLexical(ticket: SupportTicket, queryTokens: readonly string[]) {
  const reasons = new Set<string>();
  let score = 0;

  const weightedFields = [
    { name: "title", text: ticket.title, weight: 5 },
    { name: "description", text: ticket.description, weight: 2 },
    { name: "service", text: ticket.service.replace("_", " "), weight: 4 },
    { name: "environment", text: ticket.environment, weight: 1.25 },
    { name: "status", text: ticket.status.replace("_", " "), weight: 1.25 },
    { name: "priority", text: ticket.priority, weight: 1.5 },
    { name: "assignedTeam", text: ticket.assignedTeam.replace("-", " "), weight: 1.5 },
    { name: "tags", text: ticket.tags.join(" "), weight: 3 }
  ];

  for (const token of queryTokens) {
    for (const field of weightedFields) {
      const fieldTokens = new Set(tokenize(field.text));
      if (fieldTokens.has(token) || field.text.toLowerCase().includes(token)) {
        score += field.weight;
        reasons.add(`${field.name}:${token}`);
      }
    }
  }

  return {
    lexicalScore: queryTokens.length > 0 ? score / queryTokens.length : 0,
    reasons: [...reasons].slice(0, 8)
  };
}

function scoreTickets(
  query: string,
  tickets: readonly SupportTicket[],
  embeddings: readonly TicketEmbeddingRecord[]
): ScoredTicket[] {
  const embeddingByTicketId = new Map(
    embeddings.map((record) => [record.ticketId, record.embedding] as const)
  );
  const queryTokens = normalizeQueryTokens(query);
  const queryEmbedding = embedText(query);

  return tickets
    .map((ticket) => {
      const lexical = scoreLexical(ticket, queryTokens);
      const ticketEmbedding =
        embeddingByTicketId.get(ticket.ticketId) ?? embedText(createTicketEmbeddingText(ticket));
      const vectorScore = Math.max(cosineSimilarity(queryEmbedding, ticketEmbedding), 0) * 6;
      const score = lexical.lexicalScore + vectorScore;

      return {
        ticket,
        score: roundScore(score),
        lexicalScore: roundScore(lexical.lexicalScore),
        vectorScore: roundScore(vectorScore),
        matchReasons:
          lexical.reasons.length > 0 ? lexical.reasons : ["vector:deterministic_embedding"],
        createdAtMs: Date.parse(ticket.createdAt)
      };
    })
    .filter((result) => result.lexicalScore > 0 || result.vectorScore >= 3.5);
}

function sortResults(results: ScoredTicket[], sort: TicketSort): ScoredTicket[] {
  return [...results].sort((left, right) => {
    if (sort === "createdAt_desc" && left.createdAtMs !== right.createdAtMs) {
      return right.createdAtMs - left.createdAtMs;
    }

    if (right.score !== left.score) {
      return right.score - left.score;
    }

    return right.createdAtMs - left.createdAtMs;
  });
}

export function searchTickets(
  request: TicketSearchRequest,
  tickets: readonly SupportTicket[] = createSeedTickets(),
  embeddings: readonly TicketEmbeddingRecord[] = createTicketEmbeddings(tickets)
): TicketSearchResponse {
  const query = request.query.trim();
  if (!query) {
    throw new Error("query is required");
  }

  const filters = request.filters ?? {};
  const limit = normalizeLimit(request.limit);
  const sort = inferSort(query, request.sort);
  const filteredTickets = applyFilters(tickets, filters);
  const scoredTickets = sortResults(scoreTickets(query, filteredTickets, embeddings), sort);
  const results = scoredTickets.slice(0, limit).map(({ createdAtMs: _createdAtMs, ...result }) => result);

  return {
    query,
    filters,
    limit,
    sort,
    results,
    diagnostics: {
      totalTickets: tickets.length,
      filteredTickets: filteredTickets.length,
      returnedTickets: results.length,
      strategy: "hybrid_lexical_vector"
    }
  };
}
