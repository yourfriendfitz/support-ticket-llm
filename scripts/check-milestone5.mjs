import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { extname, join, relative } from "node:path";

const root = process.cwd();
const requiredFiles = [
  ".env.example",
  "docs/milestone-5.md",
  "infra/terraform/serverless-inference/README.md",
  "infra/terraform/serverless-inference/main.tf",
  "infra/terraform/serverless-inference/outputs.tf",
  "infra/terraform/serverless-inference/terraform.tfvars.example",
  "infra/terraform/serverless-inference/variables.tf",
  "infra/terraform/serverless-inference/versions.tf",
  "packages/adapters/src/inference.ts"
];
const terraformFiles = requiredFiles.filter((file) =>
  file.startsWith("infra/terraform/serverless-inference/")
);
const forbiddenAccountIds = ["192292428229"];
const forbiddenModelExtensions = new Set([".gguf", ".safetensors", ".bin", ".pt", ".pth"]);
const skippedDirectories = new Set([
  ".agent",
  ".git",
  ".npm-cache",
  ".terraform",
  "coverage",
  "data/local",
  "dist",
  "node_modules"
]);

const failures = [];

function assert(condition, message) {
  if (!condition) {
    failures.push(message);
  }
}

function read(file) {
  return readFileSync(join(root, file), "utf8");
}

function assertContains(value, needle, label) {
  assert(value.includes(needle), `${label} must include ${needle}`);
}

function walkFiles(directory) {
  const entries = readdirSync(directory);
  const files = [];

  for (const entry of entries) {
    const absolutePath = join(directory, entry);
    const relativePath = relative(root, absolutePath);
    if (skippedDirectories.has(relativePath) || skippedDirectories.has(entry)) {
      continue;
    }

    const stats = statSync(absolutePath);
    if (stats.isDirectory()) {
      files.push(...walkFiles(absolutePath));
    } else {
      files.push(relativePath);
    }
  }

  return files;
}

for (const file of requiredFiles) {
  assert(existsSync(join(root, file)), `Missing required file: ${file}`);
}

const terraform = terraformFiles
  .filter((file) => existsSync(join(root, file)))
  .map((file) => read(file))
  .join("\n");
assertContains(terraform, "aws_s3_bucket", "Terraform scaffold");
assertContains(terraform, "aws_s3_bucket_public_access_block", "Terraform scaffold");
assertContains(terraform, "aws_ecr_repository", "Terraform scaffold");
assertContains(terraform, "aws_lambda_function", "Terraform scaffold");
assertContains(terraform, "aws_lambda_function_url", "Terraform scaffold");
assertContains(terraform, "aws_cloudwatch_log_group", "Terraform scaffold");
assertContains(terraform, "MAX_GENERATED_TOKENS", "Terraform scaffold");
assertContains(terraform, "Qwen3-0.6B", "Terraform scaffold");
assertContains(terraform, "llama.cpp", "Terraform scaffold");

const envExample = existsSync(join(root, ".env.example")) ? read(".env.example") : "";
assertContains(envExample, "INFERENCE_PROVIDER=deterministic_mock", ".env.example");
assertContains(envExample, "INFERENCE_LAMBDA_URL=", ".env.example");
assertContains(envExample, "INFERENCE_MAX_GENERATED_TOKENS=256", ".env.example");

const adapter = existsSync(join(root, "packages/adapters/src/inference.ts"))
  ? read("packages/adapters/src/inference.ts")
  : "";
assertContains(adapter, "aws_lambda_http", "Inference adapter");
assertContains(adapter, "createLambdaHttpInferenceAdapter", "Inference adapter");
assertContains(adapter, "maxGeneratedTokens", "Inference adapter");

for (const file of [...requiredFiles, "README.md", "docs/development.md", "spec.md"]) {
  if (!existsSync(join(root, file))) {
    continue;
  }

  const content = read(file);
  for (const accountId of forbiddenAccountIds) {
    assert(!content.includes(accountId), `${file} must not contain AWS account ID ${accountId}`);
  }
}

const modelArtifacts = walkFiles(root).filter((file) =>
  forbiddenModelExtensions.has(extname(file))
);
assert(
  modelArtifacts.length === 0,
  `Model artifacts must not be committed: ${modelArtifacts.join(", ")}`
);

if (failures.length > 0) {
  for (const failure of failures) {
    console.error(`milestone5-check: ${failure}`);
  }

  process.exit(1);
}

console.log(
  JSON.stringify(
    {
      status: "ok",
      checkedFiles: requiredFiles.length,
      modelArtifacts: modelArtifacts.length
    },
    null,
    2
  )
);
