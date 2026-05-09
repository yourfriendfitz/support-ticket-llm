DOCKER_COMPOSE ?= docker compose
TERRAFORM_IMAGE ?= hashicorp/terraform:1.9.8
AWS_CLI_IMAGE ?= public.ecr.aws/aws-cli/aws-cli:latest
AWS_PROFILE ?= support-ticket-llm
AWS_REGION ?= us-east-2

.PHONY: aws-whoami build ci compose-config dev dev-shell doctor eval-answers eval-retrieval install lint milestone0-check milestone1-check milestone2-check milestone3-check milestone4-check milestone5-check milestone6-check milestone7-check seed terraform-product-fmt terraform-product-init terraform-product-validate test typecheck

compose-config:
	$(DOCKER_COMPOSE) --profile tools config

install:
	$(DOCKER_COMPOSE) run --rm tools npm install

ci:
	$(DOCKER_COMPOSE) run --rm tools npm ci

dev-shell:
	$(DOCKER_COMPOSE) run --rm tools bash

dev:
	$(DOCKER_COMPOSE) up ui api mcp-server

doctor:
	$(DOCKER_COMPOSE) run --rm tools

lint:
	$(DOCKER_COMPOSE) run --rm tools npm run lint

eval-retrieval:
	$(DOCKER_COMPOSE) run --rm tools npm run eval:retrieval

eval-answers:
	$(DOCKER_COMPOSE) run --rm tools npm run eval:answers

seed:
	$(DOCKER_COMPOSE) run --rm tools npm run seed

typecheck:
	$(DOCKER_COMPOSE) run --rm tools npm run typecheck

test:
	$(DOCKER_COMPOSE) run --rm tools npm test

build:
	$(DOCKER_COMPOSE) run --rm tools npm run build

aws-whoami:
	docker run --rm -v "$(HOME)/.aws:/root/.aws:ro" $(AWS_CLI_IMAGE) sts get-caller-identity --profile $(AWS_PROFILE) --region $(AWS_REGION)

terraform-product-fmt:
	docker run --rm -v "$(CURDIR):/workspace" -w /workspace/infra/terraform/serverless-product $(TERRAFORM_IMAGE) fmt -check

terraform-product-init:
	docker run --rm -v "$(CURDIR):/workspace" -w /workspace/infra/terraform/serverless-product $(TERRAFORM_IMAGE) init -backend=false

terraform-product-validate:
	docker run --rm -v "$(CURDIR):/workspace" -w /workspace/infra/terraform/serverless-product $(TERRAFORM_IMAGE) validate

milestone0-check: compose-config
	test -f README.md
	test -f spec.md
	test -f docs/development.md
	test -d apps/ui
	test -d apps/api
	test -d apps/mcp-server
	test -d packages/core
	test -d packages/adapters
	test -d infra/terraform
	test -d ops/k8s

milestone1-check: compose-config typecheck test build

milestone2-check: milestone1-check seed
	test -f data/local/tickets.json
	test -f data/local/ticket-embeddings.json

milestone3-check: milestone2-check eval-retrieval
	test -f evals/retrieval/queries.json

milestone4-check: milestone3-check
	test -f packages/adapters/src/inference.ts
	test -f packages/adapters/src/inference.test.ts

milestone5-check: milestone4-check
	$(DOCKER_COMPOSE) run --rm tools npm run check:milestone5

milestone6-check: milestone5-check eval-answers
	$(DOCKER_COMPOSE) run --rm tools npm run check:milestone6

milestone7-check: milestone6-check
	$(DOCKER_COMPOSE) run --rm tools npm run check:milestone7
