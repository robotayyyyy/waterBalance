# ============================================================================
# WaterF Makefile
# Watershed Management System - Development & Deployment Commands
# ============================================================================

.DEFAULT_GOAL := help
.PHONY: help install dev build start stop clean

# Colors
BLUE := \033[0;34m
GREEN := \033[0;32m
YELLOW := \033[0;33m
RED := \033[0;31m
NC := \033[0m


help: ## Show this help message
	@echo "$(BLUE)╔════════════════════════════════════════════════════════════╗$(NC)"
	@echo "$(BLUE)║  WaterF - Watershed Management System                     ║$(NC)"
	@echo "$(BLUE)╚════════════════════════════════════════════════════════════╝$(NC)"
	@echo ""
	@awk 'BEGIN {FS = ":.*##"; printf ""} /^[a-zA-Z_-]+:.*?##/ { printf "  $(YELLOW)%-20s$(NC) %s\n", $$1, $$2 } /^##@/ { printf "\n$(BLUE)%s$(NC)\n", substr($$0, 5) } ' $(MAKEFILE_LIST)
	@echo ""

install: ## Install all dependencies
	@echo "$(BLUE)Installing backend dependencies...$(NC)"
	@cd backend && npm install
	@echo "$(BLUE)Installing frontend dependencies...$(NC)"
	@cd frontend && npm install
	@echo "$(GREEN)✓ Dependencies installed$(NC)"

# ============================================================================
##@ Development
# ============================================================================
dev: ## Local dev (Node.js on your PC)
	@echo "$(BLUE)Starting PostgreSQL...$(NC)"
	@docker-compose up -d postgres
	@echo "$(YELLOW)Waiting for database...$(NC)"
	@sleep 5
	@echo "$(GREEN)✓ Database ready$(NC)"
	@echo "$(BLUE)Clearing ports...$(NC)"
	@lsof -ti:3001 | xargs kill -9 2>/dev/null || true
	@lsof -ti:3000 | xargs kill -9 2>/dev/null || true
	@echo "$(GREEN)✓ Ports cleared$(NC)"
	@echo "$(BLUE)Starting backend...$(NC)"
	@cd backend && npm run start:dev > /dev/null 2>&1 & echo $$! > ../.backend.pid
	@sleep 3
	@echo "$(GREEN)✓ Backend started$(NC)"
	@echo ""
	@echo "$(GREEN)═══════════════════════════════════════════$(NC)"
	@echo "$(GREEN)  Frontend:$(NC) http://localhost:3000"
	@echo "$(GREEN)  Backend:$(NC)  http://localhost:3001"
	@echo "$(GREEN)  Swagger:$(NC)  http://localhost:3001/api/docs"
	@echo "$(GREEN)  Map:$(NC)      http://localhost:3000/map"
	@echo "$(GREEN)═══════════════════════════════════════════$(NC)"
	@echo ""
	@echo "$(YELLOW)Press Ctrl+C to stop frontend$(NC)"
	@echo "$(YELLOW)Then run: make dev-stop$(NC)"
	@echo ""
	@cd frontend && npm run dev

dev-backend: ## Run backend only
	@cd backend && npm run start:dev

dev-frontend: ## Run frontend only
	@cd frontend && npm run dev

dev-stop: ## Stop local dev services
	@echo "$(BLUE)Stopping services...$(NC)"
	@lsof -ti:3001 | xargs kill -9 2>/dev/null || true
	@lsof -ti:3000 | xargs kill -9 2>/dev/null || true
	@if [ -f .backend.pid ]; then kill $$(cat .backend.pid) 2>/dev/null || true; rm .backend.pid; fi
	@docker-compose stop postgres
	@echo "$(GREEN)✓ All dev services stopped$(NC)"

# ============================================================================
##@ Docker Production
# ============================================================================
build: ## Docker production (all in containers)
	@echo "$(BLUE)Building and starting all services...$(NC)"
	@docker-compose up --build -d
	@echo "$(GREEN)✓ Services built and started$(NC)"
	@echo ""
	@echo "$(GREEN)═══════════════════════════════════════════$(NC)"
	@echo "$(GREEN)  Frontend:$(NC) http://localhost"
	@echo "$(GREEN)  Backend:$(NC)  http://localhost/api"
	@echo "$(GREEN)  Swagger:$(NC)  http://localhost/api/docs"
	@echo "$(GREEN)  Map:$(NC)      http://localhost/map"
	@echo "$(GREEN)═══════════════════════════════════════════$(NC)"

start: ## Start Docker services (without rebuild)
	@echo "$(BLUE)Starting all services...$(NC)"
	@docker-compose up -d
	@echo "$(GREEN)✓ Services started$(NC)"

stop: ## Stop all Docker services
	@echo "$(BLUE)Stopping all services...$(NC)"
	@docker-compose down
	@echo "$(GREEN)✓ Services stopped$(NC)"

restart: ## Restart all Docker services
	@echo "$(BLUE)Restarting all services...$(NC)"
	@docker-compose restart
	@echo "$(GREEN)✓ Services restarted$(NC)"

ps: ## Show running containers
	@docker-compose ps

logs: ## View all service logs
	@docker-compose logs -f

logs-backend: ## Backend logs only
	@docker-compose logs -f nestjs

logs-frontend: ## Frontend logs only
	@docker-compose logs -f nextjs

logs-db: ## Database logs only
	@docker-compose logs -f postgres

# ============================================================================
##@ Database
# ============================================================================

db-connect: ## Connect to PostgreSQL CLI
	@docker exec -it postgres_db psql -U postgres -d postgres

db-shell: ## Open bash in database container
	@docker exec -it postgres_db bash

db-tables: ## List all tables
	@docker exec -it postgres_db psql -U postgres -d postgres -c "\dt"

db-version: ## Show PostGIS version
	@docker exec -it postgres_db psql -U postgres -c "SELECT PostGIS_Version();"

db-query: ## Show data counts
	@echo "$(BLUE)River count:$(NC)"
	@docker exec -it postgres_db psql -U postgres -d postgres -c "SELECT COUNT(*) FROM rivers;"
	@echo "$(BLUE)Basin count:$(NC)"
	@docker exec -it postgres_db psql -U postgres -d postgres -c "SELECT COUNT(*) FROM basins;"

db-reset: ## Reset database (⚠️ DELETES ALL DATA)
	@echo "$(RED)⚠️  This will DELETE ALL DATA!$(NC)"
	@echo "$(YELLOW)Press Ctrl+C to cancel...$(NC)"
	@sleep 3
	@docker-compose down -v
	@docker-compose up -d postgres
	@echo "$(GREEN)✓ Database reset complete$(NC)"

# ============================================================================
##@ Testing
# ============================================================================

test: ## Run all backend tests
	@cd backend && npm run test

test-watch: ## Run tests in watch mode
	@cd backend && npm run test:watch

test-cov: ## Run tests with coverage
	@cd backend && npm run test:cov

test-e2e: ## Run end-to-end tests
	@cd backend && npm run test:e2e

# ============================================================================
##@ Code Quality
# ============================================================================

lint: ## Lint backend and frontend
	@echo "$(BLUE)Linting backend...$(NC)"
	@cd backend && npm run lint
	@echo "$(BLUE)Linting frontend...$(NC)"
	@cd frontend && npm run lint
	@echo "$(GREEN)✓ Linting complete$(NC)"

lint-backend: ## Lint backend only
	@cd backend && npm run lint

lint-frontend: ## Lint frontend only
	@cd frontend && npm run lint

typecheck: ## TypeScript type check
	@echo "$(BLUE)Checking backend types...$(NC)"
	@cd backend && npx tsc --noEmit && echo "$(GREEN)✓ Backend types OK$(NC)" || echo "$(RED)✗ Backend type errors$(NC)"
	@echo ""
	@echo "$(BLUE)Checking frontend types...$(NC)"
	@cd frontend && npx tsc --noEmit && echo "$(GREEN)✓ Frontend types OK$(NC)" || echo "$(RED)✗ Frontend type errors$(NC)"

format: ## Format backend code
	@cd backend && npm run format

# ============================================================================
##@ Building
# ============================================================================

build-backend: ## Build backend only
	@cd backend && npm run build

build-frontend: ## Build frontend only
	@cd frontend && npm run build

build-check: ## Verify builds pass
	@echo "$(BLUE)Checking backend build...$(NC)"
	@cd backend && npm run build
	@echo "$(GREEN)✓ Backend builds$(NC)"
	@echo ""
	@echo "$(BLUE)Checking frontend build...$(NC)"
	@cd frontend && npm run build
	@echo "$(GREEN)✓ Frontend builds$(NC)"
	@echo ""
	@echo "$(GREEN)✓ All builds passed!$(NC)"

# ============================================================================
##@ Utilities
# ============================================================================

health: ## Check backend health
	@echo "$(BLUE)Checking backend health...$(NC)"
	@curl -s http://localhost:3001/health | jq 2>/dev/null || echo "$(YELLOW)Backend not running$(NC)"

api-test: ## Test API endpoints
	@echo "$(BLUE)Testing rivers endpoint...$(NC)"
	@curl -s http://localhost:3001/geo/rivers | jq '.features | length' 2>/dev/null || echo "$(YELLOW)Failed$(NC)"
	@echo "$(BLUE)Testing basins endpoint...$(NC)"
	@curl -s http://localhost:3001/geo/basins | jq '.features | length' 2>/dev/null || echo "$(YELLOW)Failed$(NC)"

swagger: ## Show Swagger URL
	@echo "$(GREEN)Swagger UI:$(NC) http://localhost:3001/api/docs"
	@echo "$(YELLOW)Make sure backend is running!$(NC)"

clean: ## Clean build artifacts
	@echo "$(BLUE)Cleaning...$(NC)"
	@rm -rf backend/dist backend/node_modules
	@rm -rf frontend/.next frontend/node_modules
	@echo "$(GREEN)✓ Cleaned$(NC)"

killport: ## Kill process on port (usage: make killport PORT=3000)
	@if [ -z "$(PORT)" ]; then \
		echo "$(RED)Usage: make killport PORT=3000$(NC)"; \
		exit 1; \
	fi
	@echo "$(BLUE)Killing process on port $(PORT)...$(NC)"
	@lsof -ti:$(PORT) | xargs kill -9 2>/dev/null || echo "$(YELLOW)No process found$(NC)"
	@echo "$(GREEN)✓ Port $(PORT) cleared$(NC)"
