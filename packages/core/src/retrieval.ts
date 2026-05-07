import {
  cosineSimilarity,
  createTicketEmbeddingText,
  createTicketEmbeddings,
  embedText,
  tokenize
} from "./embeddings.js";
import { createSeedTickets } from "./seed.js";
import type {
  PlannedTicketSearchResponse,
  QueryPlan,
  SupportTicket,
  TicketEmbeddingRecord,
  TicketLookupRequest,
  TicketSearchFilters,
  TicketSearchRequest,
  TicketSearchResponse,
  TicketSearchResult,
  TicketStatus,
  TicketSort,
  TicketsLookupRequest
} from "./types.js";

export const DEFAULT_SEARCH_LIMIT = 5;
export const MAX_SEARCH_LIMIT = 10;
export const DEFAULT_QUERY_REFERENCE_DATE = "2026-05-07T12:00:00.000Z";

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
const allTerms = new Set(["all", "list", "show"]);

const serviceAliases = {
  lambda: ["lambda", "function", "functions"],
  eks: ["eks", "kubernetes", "pod", "pods", "cluster"],
  dynamodb: ["dynamodb", "dynamo", "table", "tables"],
  iam: ["iam", "policy", "role", "permission", "permissions"],
  api_gateway: ["api", "gateway", "api_gateway", "apigateway"],
  s3: ["s3", "bucket", "buckets", "object", "objects"],
  cloudwatch: ["cloudwatch", "alarm", "metric", "metrics", "logs"],
  opensearch: ["opensearch", "search", "index", "indices"]
} as const;

const statusAliases: Record<TicketStatus, readonly string[]> = {
  open: ["open", "opened"],
  in_progress: ["in progress", "in-progress", "in_progress"],
  blocked: ["blocked", "blocking"],
  resolved: ["resolved"],
  closed: ["closed"]
};

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

function normalizeTicketIds(ticketIds: readonly string[], limit = MAX_SEARCH_LIMIT): string[] {
  const seen = new Set<string>();
  const normalizedTicketIds: string[] = [];

  for (const ticketId of ticketIds) {
    const normalizedTicketId = ticketId.trim();
    if (!normalizedTicketId || seen.has(normalizedTicketId)) {
      continue;
    }

    seen.add(normalizedTicketId);
    normalizedTicketIds.push(normalizedTicketId);

    if (normalizedTicketIds.length >= limit) {
      break;
    }
  }

  return normalizedTicketIds;
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

function inferLimit(queryTokens: readonly string[], requestedLimit: number | undefined): number {
  if (requestedLimit !== undefined) {
    return normalizeLimit(requestedLimit);
  }

  return queryTokens.some((token) => allTerms.has(token)) ? MAX_SEARCH_LIMIT : DEFAULT_SEARCH_LIMIT;
}

function inferServices(queryTokens: readonly string[]) {
  return Object.entries(serviceAliases)
    .filter(([, aliases]) => aliases.some((alias) => queryTokens.includes(alias)))
    .map(([service]) => service) as TicketSearchFilters["services"];
}

function inferStatuses(query: string, queryTokens: readonly string[]) {
  const normalizedQuery = query.toLowerCase().replace(/\s+/g, " ");

  return Object.entries(statusAliases)
    .filter(([, aliases]) =>
      aliases.some((alias) =>
        alias.includes(" ") || alias.includes("-") || alias.includes("_")
          ? normalizedQuery.includes(alias)
          : queryTokens.includes(alias)
      )
    )
    .map(([status]) => status) as TicketSearchFilters["statuses"];
}

function inferDateFilters(
  queryTokens: readonly string[],
  referenceDate: Date
): Pick<TicketSearchFilters, "createdAfter" | "createdBefore"> {
  if (!queryTokens.includes("week") && !queryTokens.includes("weekly")) {
    return {};
  }

  const createdBefore = referenceDate.toISOString();
  const createdAfter = new Date(referenceDate.getTime() - 7 * 24 * 60 * 60 * 1000).toISOString();

  return {
    createdAfter,
    createdBefore
  };
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

export function getTicketById(
  request: TicketLookupRequest,
  tickets: readonly SupportTicket[] = createSeedTickets()
): SupportTicket | null {
  return tickets.find((ticket) => ticket.ticketId === request.ticketId.trim()) ?? null;
}

export function getTicketsByIds(
  request: TicketsLookupRequest,
  tickets: readonly SupportTicket[] = createSeedTickets()
): SupportTicket[] {
  const ticketById = new Map(tickets.map((ticket) => [ticket.ticketId, ticket] as const));

  return normalizeTicketIds(request.ticketIds).flatMap((ticketId) => {
    const ticket = ticketById.get(ticketId);
    return ticket ? [ticket] : [];
  });
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

function sortResults(results: readonly ScoredTicket[], sort: TicketSort): ScoredTicket[] {
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

function createSearchResponse(
  request: TicketSearchRequest,
  strategy: TicketSearchResponse["diagnostics"]["strategy"],
  tickets: readonly SupportTicket[],
  scoredTickets: readonly ScoredTicket[],
  filteredTickets: readonly SupportTicket[],
  limit: number,
  sort: TicketSort
): TicketSearchResponse {
  const results = scoredTickets
    .slice(0, limit)
    .map(({ createdAtMs: _createdAtMs, ...result }) => result);

  return {
    query: request.query.trim(),
    filters: request.filters ?? {},
    limit,
    sort,
    results,
    diagnostics: {
      totalTickets: tickets.length,
      filteredTickets: filteredTickets.length,
      returnedTickets: results.length,
      strategy
    }
  };
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
  return createSearchResponse(
    request,
    "hybrid_lexical_vector",
    tickets,
    scoredTickets,
    filteredTickets,
    limit,
    sort
  );
}

export function semanticSearchTickets(
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
  const queryEmbedding = embedText(query);
  const filteredTickets = applyFilters(tickets, filters);
  const ticketById = new Map(tickets.map((ticket) => [ticket.ticketId, ticket] as const));
  const scoredTickets = sortResults(
    embeddings
      .flatMap((record) => {
        const ticket = ticketById.get(record.ticketId);
        if (!ticket || !filteredTickets.includes(ticket)) {
          return [];
        }

        const vectorScore = Math.max(cosineSimilarity(queryEmbedding, record.embedding), 0) * 6;

        return [
          {
            ticket,
            score: roundScore(vectorScore),
            lexicalScore: 0,
            vectorScore: roundScore(vectorScore),
            matchReasons: ["vector:deterministic_embedding"],
            createdAtMs: Date.parse(ticket.createdAt)
          }
        ];
      })
      .filter((result) => result.vectorScore >= 3.5),
    sort
  );

  return createSearchResponse(
    request,
    "deterministic_vector",
    tickets,
    scoredTickets,
    filteredTickets,
    limit,
    sort
  );
}

export function planTicketQuery(
  query: string,
  options: {
    limit?: number;
    referenceDate?: Date;
  } = {}
): QueryPlan {
  const originalQuery = query.trim();
  if (!originalQuery) {
    throw new Error("query is required");
  }

  const queryTokens = tokenize(originalQuery);
  const services = inferServices(queryTokens);
  const statuses = inferStatuses(originalQuery, queryTokens);
  const referenceDate =
    options.referenceDate ?? new Date(DEFAULT_QUERY_REFERENCE_DATE);
  const filters: TicketSearchFilters = {
    ...inferDateFilters(queryTokens, referenceDate),
    ...(services && services.length > 0 ? { services } : {}),
    ...(statuses && statuses.length > 0 ? { statuses } : {})
  };
  const limit = inferLimit(queryTokens, options.limit);
  const sort = inferSort(originalQuery, undefined);

  return {
    originalQuery,
    retrievalQuery: originalQuery,
    filters,
    limit,
    sort,
    useSemanticSearch: true,
    candidateTicketIds: [],
    reasoning: [
      ...(services && services.length > 0 ? [`services:${services.join(",")}`] : []),
      ...(statuses && statuses.length > 0 ? [`statuses:${statuses.join(",")}`] : []),
      ...(filters.createdAfter ? ["date:last_7_days"] : []),
      `limit:${limit}`,
      `sort:${sort}`
    ]
  };
}

export function mergeTicketSearchResults(
  lexicalResults: readonly TicketSearchResult[],
  semanticResults: readonly TicketSearchResult[],
  limit: number,
  sort: TicketSort
): TicketSearchResult[] {
  const mergedByTicketId = new Map<string, TicketSearchResult>();

  for (const result of [...lexicalResults, ...semanticResults]) {
    const previous = mergedByTicketId.get(result.ticket.ticketId);
    if (!previous) {
      mergedByTicketId.set(result.ticket.ticketId, result);
      continue;
    }

    mergedByTicketId.set(result.ticket.ticketId, {
      ...previous,
      score: roundScore(Math.max(previous.score, result.score)),
      lexicalScore: roundScore(Math.max(previous.lexicalScore, result.lexicalScore)),
      vectorScore: roundScore(Math.max(previous.vectorScore, result.vectorScore)),
      matchReasons: [...new Set([...previous.matchReasons, ...result.matchReasons])].slice(0, 8)
    });
  }

  return [...mergedByTicketId.values()]
    .sort((left, right) => {
      if (sort === "createdAt_desc") {
        const createdAtDiff = Date.parse(right.ticket.createdAt) - Date.parse(left.ticket.createdAt);
        if (createdAtDiff !== 0) {
          return createdAtDiff;
        }
      }

      return right.score - left.score;
    })
    .slice(0, limit);
}

export function hydrateTicketSearchResults(
  results: readonly TicketSearchResult[],
  hydratedTickets: readonly SupportTicket[]
): TicketSearchResult[] {
  const hydratedByTicketId = new Map(
    hydratedTickets.map((ticket) => [ticket.ticketId, ticket] as const)
  );

  return results.flatMap((result) => {
    const ticket = hydratedByTicketId.get(result.ticket.ticketId);
    return ticket ? [{ ...result, ticket }] : [];
  });
}

export function planAndSearchTickets(
  query: string,
  tickets: readonly SupportTicket[] = createSeedTickets(),
  embeddings: readonly TicketEmbeddingRecord[] = createTicketEmbeddings(tickets),
  options: {
    limit?: number;
    referenceDate?: Date;
  } = {}
): PlannedTicketSearchResponse {
  const plan = planTicketQuery(query, options);
  const searchRequest: TicketSearchRequest = {
    query: plan.retrievalQuery,
    filters: plan.filters,
    limit: plan.limit,
    sort: plan.sort
  };
  const search = searchTickets(searchRequest, tickets, embeddings);
  const semanticSearch = semanticSearchTickets(searchRequest, tickets, embeddings);
  const mergedResults = mergeTicketSearchResults(
    search.results,
    plan.useSemanticSearch ? semanticSearch.results : [],
    plan.limit,
    plan.sort
  );
  const candidateTicketIds = mergedResults.map((result) => result.ticket.ticketId);
  const hydratedTickets = getTicketsByIds({ ticketIds: candidateTicketIds }, tickets);
  const hydratedResults = hydrateTicketSearchResults(mergedResults, hydratedTickets);

  return {
    plan: {
      ...plan,
      candidateTicketIds
    },
    search,
    semanticSearch,
    hydratedTickets,
    results: hydratedResults,
    diagnostics: {
      lexicalCandidateCount: search.results.length,
      semanticCandidateCount: semanticSearch.results.length,
      hydratedTicketCount: hydratedTickets.length,
      returnedTickets: hydratedResults.length,
      strategy: "merged_candidates"
    }
  };
}
