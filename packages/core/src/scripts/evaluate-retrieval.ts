import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { createTicketEmbeddings } from "../embeddings.js";
import {
  planAndSearchTickets,
  planTicketQuery,
  searchTickets,
  semanticSearchTickets
} from "../retrieval.js";
import { createSeedTickets } from "../seed.js";
import type { TicketSearchRequest, TicketSearchResult, TicketSort } from "../types.js";

type RetrievalEvalCase = {
  query: string;
  expectedTicketIds: string[];
};

type RetrievalEvalStrategy = "keywordOnly" | "vectorOnly" | "hybridMerged";

type StrategyMetrics = {
  cases: number;
  passingCases: number;
  recallAtLimit: number;
};

const repoRoot = fileURLToPath(new URL("../../../../", import.meta.url));
const evalPath = resolve(repoRoot, "evals/retrieval/queries.json");
const evalCases = JSON.parse(await readFile(evalPath, "utf8")) as RetrievalEvalCase[];
const tickets = createSeedTickets();
const embeddings = createTicketEmbeddings(tickets);
const strategyNames: RetrievalEvalStrategy[] = ["keywordOnly", "vectorOnly", "hybridMerged"];
const strategyHits: Record<RetrievalEvalStrategy, number> = {
  keywordOnly: 0,
  vectorOnly: 0,
  hybridMerged: 0
};

function sortForEval(
  results: readonly TicketSearchResult[],
  sort: TicketSort
): TicketSearchResult[] {
  return [...results].sort((left, right) => {
    if (sort === "createdAt_desc") {
      const createdAtDiff =
        Date.parse(right.ticket.createdAt) - Date.parse(left.ticket.createdAt);
      if (createdAtDiff !== 0) {
        return createdAtDiff;
      }
    }

    return right.score - left.score;
  });
}

function keywordOnlyResults(request: TicketSearchRequest): TicketSearchResult[] {
  return sortForEval(
    searchTickets(request, tickets, embeddings).results
      .filter((result) => result.lexicalScore > 0)
      .map((result) => ({
        ...result,
        score: result.lexicalScore,
        vectorScore: 0,
        matchReasons: result.matchReasons.filter((reason) => !reason.startsWith("vector:"))
      })),
    request.sort ?? "relevance"
  ).slice(0, request.limit);
}

function vectorOnlyResults(request: TicketSearchRequest): TicketSearchResult[] {
  return semanticSearchTickets(request, tickets, embeddings).results;
}

function hybridMergedResults(query: string): TicketSearchResult[] {
  return planAndSearchTickets(query, tickets, embeddings).results;
}

function evaluateReturnedIds(
  evalCase: RetrievalEvalCase,
  strategy: RetrievalEvalStrategy,
  returnedTicketIds: readonly string[]
): boolean {
  const missingTicketIds = evalCase.expectedTicketIds.filter(
    (ticketId) => !returnedTicketIds.includes(ticketId)
  );

  if (missingTicketIds.length === 0) {
    return true;
  }

  if (strategy === "hybridMerged") {
    console.error(
      `Retrieval eval failed for "${evalCase.query}" using ${strategy}. Missing: ${missingTicketIds.join(", ")}. Returned: ${returnedTicketIds.join(", ")}`
    );
  }

  return false;
}

for (const evalCase of evalCases) {
  const plan = planTicketQuery(evalCase.query);
  const request: TicketSearchRequest = {
    query: plan.retrievalQuery,
    filters: plan.filters,
    limit: plan.limit,
    sort: plan.sort
  };
  const strategyResults: Record<RetrievalEvalStrategy, TicketSearchResult[]> = {
    keywordOnly: keywordOnlyResults(request),
    vectorOnly: vectorOnlyResults(request),
    hybridMerged: hybridMergedResults(evalCase.query)
  };

  for (const strategyName of strategyNames) {
    const returnedTicketIds = strategyResults[strategyName].map(
      (result) => result.ticket.ticketId
    );
    if (evaluateReturnedIds(evalCase, strategyName, returnedTicketIds)) {
      strategyHits[strategyName] += 1;
    }
  }
}

const strategies = Object.fromEntries(
  strategyNames.map((strategyName) => [
    strategyName,
    {
      cases: evalCases.length,
      passingCases: strategyHits[strategyName],
      recallAtLimit: strategyHits[strategyName] / evalCases.length
    } satisfies StrategyMetrics
  ])
) as Record<RetrievalEvalStrategy, StrategyMetrics>;

console.log(
  JSON.stringify(
    {
      cases: evalCases.length,
      requiredStrategy: "hybridMerged",
      passingCases: strategies.hybridMerged.passingCases,
      recallAtLimit: strategies.hybridMerged.recallAtLimit,
      strategies
    },
    null,
    2
  )
);

if (strategies.hybridMerged.passingCases !== evalCases.length) {
  process.exit(1);
}
