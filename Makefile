DOCKER_COMPOSE ?= docker compose

.PHONY: build ci compose-config dev dev-shell doctor eval-retrieval install lint milestone0-check milestone1-check milestone2-check milestone3-check milestone4-check seed test typecheck

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

seed:
	$(DOCKER_COMPOSE) run --rm tools npm run seed

typecheck:
	$(DOCKER_COMPOSE) run --rm tools npm run typecheck

test:
	$(DOCKER_COMPOSE) run --rm tools npm test

build:
	$(DOCKER_COMPOSE) run --rm tools npm run build

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
