import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";

const root = process.cwd();
const stackDirectory = "infra/terraform/serverless-product";
const requiredFiles = [
  ".gitignore",
  "docs/development.md",
  "docs/milestone-7.md",
  "infra/terraform/serverless-product/.terraform.lock.hcl",
  "infra/terraform/serverless-product/README.md",
  "infra/terraform/serverless-product/main.tf",
  "infra/terraform/serverless-product/outputs.tf",
  "infra/terraform/serverless-product/terraform.tfvars.example",
  "infra/terraform/serverless-product/variables.tf",
  "infra/terraform/serverless-product/versions.tf",
  "Makefile",
  "package.json",
  "README.md",
  "spec.md"
];
const terraformFiles = requiredFiles.filter((file) => file.startsWith(`${stackDirectory}/`));
const forbiddenAccountIds = ["192292428229"];
const forbiddenTerraformResources = [
  "aws_api_gateway_rest_api",
  "aws_apigatewayv2_api",
  "aws_bedrock",
  "aws_db_instance",
  "aws_eks_cluster",
  "aws_nat_gateway",
  "aws_opensearch",
  "aws_organizations_organization",
  "aws_vpc_endpoint"
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

function assertContains(value, needle, label) {
  assert(value.includes(needle), `${label} must include ${needle}`);
}

for (const file of requiredFiles) {
  assert(existsSync(join(root, file)), `Missing required file: ${file}`);
}

const terraform = terraformFiles
  .filter((file) => existsSync(join(root, file)))
  .map((file) => read(file))
  .join("\n");

assertContains(terraform, "aws_dynamodb_table", "Milestone 7 Terraform");
assertContains(terraform, "aws_s3_bucket_website_configuration", "Milestone 7 Terraform");
assertContains(terraform, "aws_lambda_function", "Milestone 7 Terraform");
assertContains(terraform, "aws_lambda_function_url", "Milestone 7 Terraform");
assertContains(terraform, "aws_ecr_repository", "Milestone 7 Terraform");
assertContains(terraform, "aws_cloudwatch_log_group", "Milestone 7 Terraform");
assertContains(terraform, "aws_iam_role_policy", "Milestone 7 Terraform");
assertContains(terraform, "Qwen3-0.6B", "Milestone 7 Terraform");
assertContains(terraform, "llama.cpp", "Milestone 7 Terraform");
assertContains(terraform, "TICKETS_TABLE_NAME", "Milestone 7 Terraform");
assertContains(terraform, "EMBEDDINGS_TABLE_NAME", "Milestone 7 Terraform");
assertContains(terraform, "MCP_LAMBDA_FUNCTION_NAME", "Milestone 7 Terraform");
assertContains(terraform, "INFERENCE_LAMBDA_FUNCTION_NAME", "Milestone 7 Terraform");
assertContains(terraform, 'default     = "PROVISIONED"', "Milestone 7 Terraform");
assertContains(terraform, "default     = 1", "Milestone 7 Terraform");
assertContains(terraform, "retention_in_days = var.log_retention_days", "Milestone 7 Terraform");
assertContains(terraform, "enable_static_website_public_read", "Milestone 7 Terraform");
assertContains(terraform, "block_public_policy     = !var.enable_static_website_public_read", "Milestone 7 Terraform");
assertContains(terraform, "restrict_public_buckets = true", "Milestone 7 Terraform");

for (const forbidden of forbiddenTerraformResources) {
  assert(
    !terraform.includes(forbidden),
    `Milestone 7 Terraform must not include free-plan-unsafe resource ${forbidden}`
  );
}

for (const file of requiredFiles) {
  if (!existsSync(join(root, file))) {
    continue;
  }

  const content = read(file);
  for (const accountId of forbiddenAccountIds) {
    assert(!content.includes(accountId), `${file} must not contain AWS account ID ${accountId}`);
  }
}

const gitignore = existsSync(join(root, ".gitignore")) ? read(".gitignore") : "";
assertContains(gitignore, ".aws.creds", ".gitignore");
assertContains(gitignore, "**/.terraform/", ".gitignore");
assertContains(gitignore, "*.tfstate", ".gitignore");

const packageJson = existsSync(join(root, "package.json")) ? read("package.json") : "";
assertContains(packageJson, "check:milestone7", "package.json");

const makefile = existsSync(join(root, "Makefile")) ? read("Makefile") : "";
assertContains(makefile, "milestone7-check", "Makefile");
assertContains(makefile, "terraform-product-fmt", "Makefile");

const readme = existsSync(join(root, "README.md")) ? read("README.md") : "";
assertContains(readme, "Milestone 7", "README.md");
assertContains(readme, "serverless AWS product slice", "README.md");

if (failures.length > 0) {
  for (const failure of failures) {
    console.error(`milestone7-check: ${failure}`);
  }

  process.exit(1);
}

console.log(
  JSON.stringify(
    {
      status: "ok",
      checkedFiles: requiredFiles.length,
      forbiddenResources: forbiddenTerraformResources.length
    },
    null,
    2
  )
);
