.PHONY: help install build dev dev-backend dev-frontend start stop restart logs clean test db-connect db-reset swagger

# Colors for output
BLUE := \033[0;34m
GREEN := \033[0;32m
YELLOW := \033[0;33m
NC := \033[0m # No Color

help: ## Show this help message
	@echo "$(BLUE)WaterF - Watershed Management System$(NC)"
	@echo ""
	@echo "$(GREEN)Available commands:$(NC)"
	@awk 'BEGIN {FS = ":.*##"; printf ""} /^[a-zA-Z_-]+:.*?##/ { printf "  $(YELLOW)%-15s$(NC) %s\n", $$1, $$2 } /^##@/ { printf "\n$(BLUE)%s$(NC)\n", substr($$0, 5) } ' $(MAKEFILE_LIST)

##@ Installation

install: ## Install all dependencies (backend + frontend)
	@echo "$(BLUE)Installing backend dependencies...$(NC)"
	cd backend && npm install
	@echo "$(BLUE)Installing frontend dependencies...$(NC)"
	cd frontend && npm install
	@echo "$(GREEN)✓ Dependencies installed$(NC)"

##@ Development

dev: ## Start local development (postgres + backend + frontend)
	@echo "$(BLUE)Starting PostgreSQL...$(NC)"
	docker-compose up -d postgres
	@echo "$(YELLOW)Waiting for database to be ready...$(NC)"
	@sleep 5
	@echo "$(GREEN)✓ Database ready$(NC)"
	@echo ""
	@echo "$(BLUE)Start backend with:$(NC) cd backend && npm run start:dev"
	@echo "$(BLUE)Start frontend with:$(NC) cd frontend && npm run dev"
	@echo ""
	@echo "$(GREEN)Backend:$(NC) http://localhost:3001"
	@echo "$(GREEN)Frontend:$(NC) http://localhost:3000"
	@echo "$(GREEN)Swagger:$(NC) http://localhost:3001/api/docs"

dev-backend: ## Start backend development server only
	cd backend && npm run start:dev

dev-frontend: ## Start frontend development server only
	cd frontend && npm run dev

##@ Docker

start: ## Start all services with Docker Compose
	@echo "$(BLUE)Starting all services...$(NC)"
	docker-compose up -d
	@echo "$(GREEN)✓ Services started$(NC)"
	@echo "$(GREEN)Frontend:$(NC) http://localhost"
	@echo "$(GREEN)Backend:$(NC) http://localhost/api"
	@echo "$(GREEN)Swagger:$(NC) http://localhost/api/docs"
	@echo "$(GREEN)Database:$(NC) localhost:5432"

build: ## Build and start all services with Docker Compose
	@echo "$(BLUE)Building and starting all services...$(NC)"
	docker-compose up --build -d
	@echo "$(GREEN)✓ Services built and started$(NC)"

stop: ## Stop all Docker services
	@echo "$(BLUE)Stopping all services...$(NC)"
	docker-compose down
	@echo "$(GREEN)✓ Services stopped$(NC)"

restart: ## Restart all Docker services
	@echo "$(BLUE)Restarting all services...$(NC)"
	docker-compose restart
	@echo "$(GREEN)✓ Services restarted$(NC)"

logs: ## View logs from all services
	docker-compose logs -f

logs-backend: ## View backend logs only
	docker-compose logs -f nestjs

logs-frontend: ## View frontend logs only
	docker-compose logs -f nextjs

logs-db: ## View database logs only
	docker-compose logs -f postgres

##@ Database

db-connect: ## Connect to PostgreSQL database
	docker exec -it postgres_db psql -U postgres -d postgres

db-shell: ## Open bash shell in PostgreSQL container
	docker exec -it postgres_db bash

db-reset: ## Reset database (WARNING: deletes all data)
	@echo "$(YELLOW)⚠️  This will delete all data! Press Ctrl+C to cancel...$(NC)"
	@sleep 3
	docker-compose down -v
	docker-compose up -d postgres
	@echo "$(GREEN)✓ Database reset complete$(NC)"

db-query: ## Quick database queries
	@echo "$(BLUE)River count:$(NC)"
	@docker exec -it postgres_db psql -U postgres -d postgres -c "SELECT COUNT(*) FROM rivers;"
	@echo "$(BLUE)Basin count:$(NC)"
	@docker exec -it postgres_db psql -U postgres -d postgres -c "SELECT COUNT(*) FROM basins;"

db-tables: ## List all database tables
	docker exec -it postgres_db psql -U postgres -d postgres -c "\dt"

db-version: ## Check PostGIS version
	docker exec -it postgres_db psql -U postgres -c "SELECT PostGIS_Version();"

##@ Testing

test-backend: ## Run backend tests
	cd backend && npm run test

test-backend-watch: ## Run backend tests in watch mode
	cd backend && npm run test:watch

test-backend-cov: ## Run backend tests with coverage
	cd backend && npm run test:cov

test-e2e: ## Run end-to-end tests
	cd backend && npm run test:e2e

##@ Building

build-backend: ## Build backend for production
	cd backend && npm run build

build-frontend: ## Build frontend for production
	cd frontend && npm run build

##@ Linting

lint-backend: ## Lint backend code
	cd backend && npm run lint

lint-frontend: ## Lint frontend code
	cd frontend && npm run lint

format-backend: ## Format backend code
	cd backend && npm run format

##@ API Documentation

swagger: ## Open Swagger documentation
	@echo "$(GREEN)Swagger UI:$(NC) http://localhost:3001/api/docs"
	@echo "$(YELLOW)Make sure backend is running!$(NC)"

##@ Utilities

clean: ## Clean all build artifacts and dependencies
	@echo "$(BLUE)Cleaning build artifacts...$(NC)"
	rm -rf backend/dist backend/node_modules
	rm -rf frontend/.next frontend/node_modules
	@echo "$(GREEN)✓ Cleaned$(NC)"

ps: ## Show running containers
	docker-compose ps

health: ## Check API health
	@echo "$(BLUE)Checking backend health...$(NC)"
	@curl -s http://localhost:3001/health | jq || echo "$(YELLOW)Backend not running or jq not installed$(NC)"

api-test: ## Test API endpoints
	@echo "$(BLUE)Testing rivers endpoint...$(NC)"
	@curl -s http://localhost:3001/api/geo/rivers | jq '.features | length' || echo "$(YELLOW)Backend not running$(NC)"
	@echo "$(BLUE)Testing basins endpoint...$(NC)"
	@curl -s http://localhost:3001/api/geo/basins | jq '.features | length' || echo "$(YELLOW)Backend not running$(NC)"
