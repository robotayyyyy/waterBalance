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

init-linux:
	sudo apt-get install docker-compose-plugin
	sudo apt update && sudo apt install docker.io docker-compose -y
	sudo usermod -aG docker $USER

env: ## Create .env files from .env.example
	@rm -f backend/.env frontend/.env || true
	@rm -f backend/.env frontend/.env || true
	@cp -f .env backend/.env 2>/dev/null || true
	@cp -f .env frontend/.env 2>/dev/null || true
	@chmod -R 644 init-scripts/*.sql
	@echo "$(GREEN)✓ .env files created (if not existing)$(NC)"
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

hard-reset: ## Reset all plus database (⚠️ DELETES ALL DATA)
	@echo "$(RED)⚠️  This will DELETE ALL DATA!$(NC)"
	@echo "$(YELLOW)Press Ctrl+C to cancel...$(NC)"
	@sleep 3
	@docker-compose down -v
	@docker-compose pull
	@docker-compose up --build -d
	@echo "$(GREEN)✓ reset complete$(NC)"

import-thailand: ## Import Thailand river data from OpenStreetMap
	@echo "$(BLUE)Importing Thailand river data...$(NC)"
	@docker-compose exec -e DATABASE_HOST=postgres nestjs node dist/scripts/import-thailand-data.js
	@echo "$(GREEN)✓ Import complete$(NC)"

import-hydrosheds: ## Import HydroSHEDS rivers/basins (Asia, Thailand bbox)
	@echo "$(BLUE)Importing HydroSHEDS data...$(NC)"
	@docker-compose exec -e DATABASE_HOST=postgres nestjs node dist/scripts/import-hydrosheds.js
	@echo "$(GREEN)✓ Import complete$(NC)"
