import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { createTicketEmbeddings } from "../embeddings.js";
import { planAndSearchTickets } from "../retrieval.js";
import { createSeedTickets } from "../seed.js";

type RetrievalEvalCase = {
  query: string;
  expectedTicketIds: string[];
};

const repoRoot = fileURLToPath(new URL("../../../../", import.meta.url));
const evalPath = resolve(repoRoot, "evals/retrieval/queries.json");
const evalCases = JSON.parse(await readFile(evalPath, "utf8")) as RetrievalEvalCase[];
const tickets = createSeedTickets();
const embeddings = createTicketEmbeddings(tickets);

let passingCases = 0;

for (const evalCase of evalCases) {
  const response = planAndSearchTickets(evalCase.query, tickets, embeddings);
  const returnedTicketIds = response.results.map((result) => result.ticket.ticketId);
  const missingTicketIds = evalCase.expectedTicketIds.filter(
    (ticketId) => !returnedTicketIds.includes(ticketId)
  );

  if (missingTicketIds.length === 0) {
    passingCases += 1;
  } else {
    console.error(
      `Retrieval eval failed for "${evalCase.query}". Missing: ${missingTicketIds.join(", ")}. Returned: ${returnedTicketIds.join(", ")}`
    );
  }
}

const recallAtLimit = passingCases / evalCases.length;
console.log(
  JSON.stringify(
    {
      cases: evalCases.length,
      passingCases,
      recallAtLimit
    },
    null,
    2
  )
);

if (passingCases !== evalCases.length) {
  process.exit(1);
}
