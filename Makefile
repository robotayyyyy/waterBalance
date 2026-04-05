.DEFAULT_GOAL := help
.PHONY: help db db-stop backend frontend kill-local prune up down logs restart hard-reset migrate import-forecast-7days import-forecast-6months import-basin-7days import-basin-6months import-all truncate-forecast

help: ## Show available commands
	@awk 'BEGIN {FS = ":.*##"} /^[a-zA-Z_-]+:.*?##/ { printf "  %-12s %s\n", $$1, $$2 }' $(MAKEFILE_LIST)

# ── Local development (postgres in Docker, apps run natively) ──────────────────

db: ## Start postgres only (for local dev)
	@docker compose up -d postgres

db-stop: ## Stop postgres
	@docker compose stop postgres

backend: ## Run backend (native)
	cp .env.local .env
	cd backend && npm run start:dev

frontend: ## Run frontend (native)
	cp .env.local .env
	@grep '^NEXT_PUBLIC_' .env.local > frontend/.env.local
	cd frontend && npm run dev

kill-local:
	-fuser -k 3000/tcp
	-fuser -k 3001/tcp

# ── EC2 / full stack ───────────────────────────────────────────────────────────

prune: ## Free disk space by removing unused Docker images, containers, and build cache
	@docker system prune -af

up: ## Build and start full stack
	cp .env.docker .env
	@docker compose build --no-cache nextjs nestjs
	@docker compose up -d

down: ## Stop all services
	@docker compose down

logs: ## Follow logs
	@docker compose logs -f

restart: ## Restart without rebuild
	@docker compose restart

hard-reset: ## ⚠️  Wipe data and rebuild from scratch
	@docker compose down -v && docker compose build --no-cache nextjs nestjs && docker compose up -d

import-forecast-7days: ## Import forecast CSVs into DB (7days tables, DB must be running)
	python3 -m pip install psycopg2-binary -q 2>/dev/null || true
	python3 scripts/import-forecast-7days.py

import-forecast-6months: ## Import forecast CSVs into DB (6months tables, DB must be running)
	python3 -m pip install psycopg2-binary -q 2>/dev/null || true
	python3 scripts/import-forecast-6months.py

import-basin-7days: ## Import basin SWAT CSVs into DB (7days model, DB must be running)
	python3 -m pip install psycopg2-binary -q 2>/dev/null || true
	python3 scripts/import-basin-7days.py

import-basin-6months: ## Import basin SWAT CSVs into DB (6months model, DB must be running)
	python3 -m pip install psycopg2-binary -q 2>/dev/null || true
	python3 scripts/import-basin-6months.py

import-all: ## Import all forecast + basin CSVs (DB must be running)
	$(MAKE) import-forecast-7days
	$(MAKE) import-forecast-6months
	$(MAKE) import-basin-7days
	$(MAKE) import-basin-6months

truncate-forecast: ## Truncate all 6 forecast tables (DB must be running)
	python3 -m pip install psycopg2-binary -q 2>/dev/null || true
	python3 scripts/truncate-forecast.py

