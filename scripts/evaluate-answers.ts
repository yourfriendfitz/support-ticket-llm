import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { createDeterministicInferenceAdapter } from "../packages/adapters/src/inference.js";
import {
  createTicketEmbeddings,
  createSeedTickets,
  planAndSearchTickets
} from "../packages/core/src/index.js";

type AnswerEvalCase = {
  query: string;
  expectedTicketIds: string[];
  expectedAnswerSubstrings: string[];
};

type AnswerEvalFailure = {
  query: string;
  missingTicketIds: string[];
  missingAnswerSubstrings: string[];
  citationValidation: string;
};

const repoRoot = fileURLToPath(new URL("../", import.meta.url));
const evalPath = resolve(repoRoot, "evals/answers/queries.json");
const evalCases = JSON.parse(await readFile(evalPath, "utf8")) as AnswerEvalCase[];
const tickets = createSeedTickets();
const embeddings = createTicketEmbeddings(tickets);
const adapter = createDeterministicInferenceAdapter();
const failures: AnswerEvalFailure[] = [];

let passingCases = 0;
let citationHitTotal = 0;
let expectedCitationTotal = 0;
let answerContainmentHits = 0;
let answerContainmentTotal = 0;

for (const evalCase of evalCases) {
  const retrieval = planAndSearchTickets(evalCase.query, tickets, embeddings);
  const answer = await adapter.generateTicketAnswer({
    message: evalCase.query,
    candidates: retrieval.results
  });
  const missingTicketIds = evalCase.expectedTicketIds.filter(
    (ticketId) => !answer.citedTicketIds.includes(ticketId)
  );
  const normalizedAnswer = answer.answer.toLowerCase();
  const missingAnswerSubstrings = evalCase.expectedAnswerSubstrings.filter(
    (substring) => !normalizedAnswer.includes(substring.toLowerCase())
  );

  expectedCitationTotal += evalCase.expectedTicketIds.length;
  citationHitTotal += evalCase.expectedTicketIds.length - missingTicketIds.length;
  answerContainmentTotal += evalCase.expectedAnswerSubstrings.length;
  answerContainmentHits +=
    evalCase.expectedAnswerSubstrings.length - missingAnswerSubstrings.length;

  if (
    missingTicketIds.length === 0 &&
    missingAnswerSubstrings.length === 0 &&
    answer.diagnostics.citationValidation === "passed"
  ) {
    passingCases += 1;
    continue;
  }

  failures.push({
    query: evalCase.query,
    missingTicketIds,
    missingAnswerSubstrings,
    citationValidation: answer.diagnostics.citationValidation
  });
}

console.log(
  JSON.stringify(
    {
      cases: evalCases.length,
      passingCases,
      citationRecall: citationHitTotal / expectedCitationTotal,
      answerContainmentRate: answerContainmentHits / answerContainmentTotal,
      failures
    },
    null,
    2
  )
);

if (failures.length > 0) {
  process.exit(1);
}
