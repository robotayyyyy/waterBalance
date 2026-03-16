.DEFAULT_GOAL := help
.PHONY: help setup-local db db-stop backend frontend up down logs restart herd-reset import

help: ## Show available commands
	@awk 'BEGIN {FS = ":.*##"} /^[a-zA-Z_-]+:.*?##/ { printf "  %-12s %s\n", $$1, $$2 }' $(MAKEFILE_LIST)

# ── Local development (postgres in Docker, apps run natively) ──────────────────

setup-local: ## First time: copy .env.local to .env (and sync frontend env)
	cp .env.local .env
	@grep '^NEXT_PUBLIC_' .env.local > frontend/.env.local

db: ## Start postgres only (for local dev)
	@docker-compose up -d postgres

db-stop: ## Stop postgres
	@docker-compose stop postgres

backend: ## Run backend (native)
	cd backend && npm run start:dev

frontend: ## Run frontend (native)
	cd frontend && npm run dev

kill-local:
	-fuser -k 3000/tcp
	-fuser -k 3001/tcp

# ── EC2 / full stack ───────────────────────────────────────────────────────────

up: ## Build and start full stack
	cp .env.docker .env
	@docker-compose build --no-cache nextjs
	@docker-compose up -d

down: ## Stop all services
	@docker-compose down

logs: ## Follow logs
	@docker-compose logs -f

restart: ## Restart without rebuild
	@docker-compose restart

hard-reset: ## ⚠️  Wipe data and rebuild from scratch
	@docker-compose down -v && docker-compose up --build -d

import: ## Run all data imports (stack must be running)
	@docker-compose exec nestjs node dist/scripts/import-thailand-data.js
	@docker-compose exec nestjs node dist/scripts/import-hydrosheds.js
