import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";

const root = process.cwd();
const requiredFiles = [
  "docs/milestone-6.md",
  "evals/answers/queries.json",
  "evals/retrieval/queries.json",
  "scripts/evaluate-answers.ts",
  "scripts/check-milestone6.mjs",
  "apps/api/src/server.ts",
  "packages/core/src/scripts/evaluate-retrieval.ts"
];
const failures = [];

function assert(condition, message) {
  if (!condition) {
    failures.push(message);
  }
}

function read(file) {
  return readFileSync(join(root, file), "utf8");
}

for (const file of requiredFiles) {
  assert(existsSync(join(root, file)), `Missing required file: ${file}`);
}

const apiServer = existsSync(join(root, "apps/api/src/server.ts"))
  ? read("apps/api/src/server.ts")
  : "";
assert(apiServer.includes("request.log.info"), "API must emit structured chat logs");
assert(apiServer.includes("requestId"), "API diagnostics must include requestId");
assert(apiServer.includes("componentLatencyMs"), "API diagnostics must include component timings");
assert(apiServer.includes("finalCitedTicketIds"), "API diagnostics must include final citations");

const retrievalEval = existsSync(join(root, "packages/core/src/scripts/evaluate-retrieval.ts"))
  ? read("packages/core/src/scripts/evaluate-retrieval.ts")
  : "";
assert(retrievalEval.includes("keywordOnly"), "Retrieval eval must compare keyword-only search");
assert(retrievalEval.includes("vectorOnly"), "Retrieval eval must compare vector-only search");
assert(retrievalEval.includes("hybridMerged"), "Retrieval eval must compare hybrid merged search");

const packageJson = existsSync(join(root, "package.json")) ? read("package.json") : "";
assert(packageJson.includes("eval:answers"), "package.json must define eval:answers");
assert(packageJson.includes("check:milestone6"), "package.json must define check:milestone6");

const makefile = existsSync(join(root, "Makefile")) ? read("Makefile") : "";
assert(makefile.includes("milestone6-check"), "Makefile must define milestone6-check");

if (failures.length > 0) {
  for (const failure of failures) {
    console.error(`milestone6-check: ${failure}`);
  }

  process.exit(1);
}

console.log(
  JSON.stringify(
    {
      status: "ok",
      checkedFiles: requiredFiles.length
    },
    null,
    2
  )
);
