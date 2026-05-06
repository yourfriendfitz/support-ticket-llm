DOCKER_COMPOSE ?= docker compose

.PHONY: compose-config dev-shell doctor milestone0-check

compose-config:
	$(DOCKER_COMPOSE) --profile tools config

dev-shell:
	$(DOCKER_COMPOSE) run --rm tools bash

doctor:
	$(DOCKER_COMPOSE) run --rm tools

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
