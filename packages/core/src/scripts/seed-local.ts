import { mkdir, writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { resolve } from "node:path";
import { createTicketEmbeddings } from "../embeddings.js";
import { createSeedTickets } from "../seed.js";

const repoRoot = fileURLToPath(new URL("../../../../", import.meta.url));
const outputDir = resolve(repoRoot, "data/local");

const tickets = createSeedTickets();
const embeddings = createTicketEmbeddings(tickets);

await mkdir(outputDir, { recursive: true });
await writeFile(resolve(outputDir, "tickets.json"), `${JSON.stringify(tickets, null, 2)}\n`);
await writeFile(
  resolve(outputDir, "ticket-embeddings.json"),
  `${JSON.stringify(embeddings, null, 2)}\n`
);

console.log(`Seeded ${tickets.length} tickets and ${embeddings.length} embeddings to ${outputDir}`);
