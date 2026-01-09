# Docker Setup Guide: Next.js + NestJS + PostgreSQL

This guide provides a complete Docker-based setup for running Next.js (frontend), NestJS (backend), and PostgreSQL (database) together.

## Table of Contents
- [Architecture Overview](#architecture-overview)
- [Project Structure](#project-structure)
- [Configuration Files](#configuration-files)
- [Setup Instructions](#setup-instructions)
- [Usage Commands](#usage-commands)
- [Production Deployment](#production-deployment)
- [Troubleshooting](#troubleshooting)

## Architecture Overview

```
┌─────────────┐
│   Next.js   │ :3000 (Frontend)
│  (Docker)   │
└──────┬──────┘
       │
       ├─────────────────────┐
       │                     │
┌──────▼──────┐       ┌──────▼──────┐
│   NestJS    │ :3001 │  PostgreSQL │ :5432
│  (Docker)   ├───────►  (Docker)   │
└─────────────┘       └─────────────┘
```

**Key Features:**
- All services run in isolated Docker containers
- Services communicate via Docker network
- PostgreSQL data persists in Docker volumes
- Health checks ensure proper startup order
- Support for both development and production modes

## Project Structure

```
project-root/
├── docker-compose.yml
├── docker-compose.dev.yml
├── .env
├── .env.example
├── .dockerignore
├── frontend/
│   ├── Dockerfile
│   ├── Dockerfile.dev
│   ├── .dockerignore
│   ├── package.json
│   ├── next.config.js
│   └── ... (Next.js files)
├── backend/
│   ├── Dockerfile
│   ├── Dockerfile.dev
│   ├── .dockerignore
│   ├── package.json
│   └── ... (NestJS files)
└── init-scripts/
    └── 01-init.sql (optional)
```

## Configuration Files

### 1. docker-compose.yml (Production)

```yaml
version: '3.8'

services:
  postgres:
    image: postgres:16-alpine
    container_name: postgres_db
    restart: unless-stopped
    environment:
      POSTGRES_USER: ${POSTGRES_USER:-postgres}
      POSTGRES_PASSWORD: ${POSTGRES_PASSWORD:-postgres}
      POSTGRES_DB: ${POSTGRES_DB:-mydb}
      PGDATA: /var/lib/postgresql/data/pgdata
    volumes:
      - postgres_data:/var/lib/postgresql/data
      - ./init-scripts:/docker-entrypoint-initdb.d
    ports:
      - "${POSTGRES_PORT:-5432}:5432"
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U ${POSTGRES_USER:-postgres}"]
      interval: 10s
      timeout: 5s
      retries: 5
    networks:
      - app-network

  nestjs:
    build:
      context: ./backend
      dockerfile: Dockerfile
      args:
        NODE_ENV: production
    container_name: nestjs_api
    restart: unless-stopped
    environment:
      NODE_ENV: production
      PORT: 3001
      DATABASE_URL: postgresql://${POSTGRES_USER:-postgres}:${POSTGRES_PASSWORD:-postgres}@postgres:5432/${POSTGRES_DB:-mydb}
      DATABASE_HOST: postgres
      DATABASE_PORT: 5432
      DATABASE_USER: ${POSTGRES_USER:-postgres}
      DATABASE_PASSWORD: ${POSTGRES_PASSWORD:-postgres}
      DATABASE_NAME: ${POSTGRES_DB:-mydb}
      JWT_SECRET: ${JWT_SECRET:-change-me-in-production}
      CORS_ORIGIN: ${CORS_ORIGIN:-http://localhost:3000}
    ports:
      - "${NESTJS_PORT:-3001}:3001"
    depends_on:
      postgres:
        condition: service_healthy
    networks:
      - app-network
    healthcheck:
      test: ["CMD-SHELL", "wget --no-verbose --tries=1 --spider http://localhost:3001/health || exit 1"]
      interval: 30s
      timeout: 10s
      retries: 3

  nextjs:
    build:
      context: ./frontend
      dockerfile: Dockerfile
      args:
        NODE_ENV: production
        NEXT_PUBLIC_API_URL: ${NEXT_PUBLIC_API_URL:-http://localhost:3001}
    container_name: nextjs_app
    restart: unless-stopped
    environment:
      NODE_ENV: production
      PORT: 3000
      NEXT_PUBLIC_API_URL: ${NEXT_PUBLIC_API_URL:-http://localhost:3001}
      NEXT_TELEMETRY_DISABLED: 1
    ports:
      - "${NEXTJS_PORT:-3000}:3000"
    depends_on:
      - nestjs
    networks:
      - app-network

networks:
  app-network:
    driver: bridge

volumes:
  postgres_data:
    driver: local
```

### 2. docker-compose.dev.yml (Development)

```yaml
version: '3.8'

services:
  postgres:
    image: postgres:16-alpine
    container_name: postgres_db_dev
    environment:
      POSTGRES_USER: ${POSTGRES_USER:-postgres}
      POSTGRES_PASSWORD: ${POSTGRES_PASSWORD:-postgres}
      POSTGRES_DB: ${POSTGRES_DB:-mydb_dev}
    volumes:
      - postgres_data_dev:/var/lib/postgresql/data
      - ./init-scripts:/docker-entrypoint-initdb.d
    ports:
      - "5432:5432"
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U ${POSTGRES_USER:-postgres}"]
      interval: 10s
      timeout: 5s
      retries: 5
    networks:
      - app-network

  nestjs:
    build:
      context: ./backend
      dockerfile: Dockerfile.dev
    container_name: nestjs_api_dev
    environment:
      NODE_ENV: development
      PORT: 3001
      DATABASE_URL: postgresql://${POSTGRES_USER:-postgres}:${POSTGRES_PASSWORD:-postgres}@postgres:5432/${POSTGRES_DB:-mydb_dev}
      DATABASE_HOST: postgres
      DATABASE_PORT: 5432
      DATABASE_USER: ${POSTGRES_USER:-postgres}
      DATABASE_PASSWORD: ${POSTGRES_PASSWORD:-postgres}
      DATABASE_NAME: ${POSTGRES_DB:-mydb_dev}
      JWT_SECRET: ${JWT_SECRET:-dev-secret}
    ports:
      - "3001:3001"
      - "9229:9229"  # Node.js debugger port
    volumes:
      - ./backend:/app
      - /app/node_modules
      - /app/dist
    depends_on:
      postgres:
        condition: service_healthy
    networks:
      - app-network
    command: npm run start:dev

  nextjs:
    build:
      context: ./frontend
      dockerfile: Dockerfile.dev
    container_name: nextjs_app_dev
    environment:
      NODE_ENV: development
      NEXT_PUBLIC_API_URL: http://localhost:3001
      WATCHPACK_POLLING: true  # Enable polling for file changes
    ports:
      - "3000:3000"
    volumes:
      - ./frontend:/app
      - /app/node_modules
      - /app/.next
    depends_on:
      - nestjs
    networks:
      - app-network
    command: npm run dev

networks:
  app-network:
    driver: bridge

volumes:
  postgres_data_dev:
    driver: local
```

### 3. Backend Dockerfile (Production)

```dockerfile
# backend/Dockerfile

# Stage 1: Dependencies
FROM node:20-alpine AS deps
WORKDIR /app

# Copy package files
COPY package*.json ./

# Install dependencies
RUN npm ci --only=production && \
    npm cache clean --force

# Stage 2: Build
FROM node:20-alpine AS build
WORKDIR /app

# Copy package files
COPY package*.json ./

# Install all dependencies (including dev)
RUN npm ci

# Copy source code
COPY . .

# Build the application
RUN npm run build

# Stage 3: Production
FROM node:20-alpine AS production

# Install dumb-init for proper signal handling
RUN apk add --no-cache dumb-init

# Set working directory
WORKDIR /app

# Create non-root user
RUN addgroup -g 1001 -S nodejs && \
    adduser -S nestjs -u 1001

# Copy production dependencies from deps stage
COPY --from=deps --chown=nestjs:nodejs /app/node_modules ./node_modules

# Copy built application from build stage
COPY --from=build --chown=nestjs:nodejs /app/dist ./dist
COPY --from=build --chown=nestjs:nodejs /app/package*.json ./

# Set environment variables
ENV NODE_ENV=production
ENV PORT=3001

# Switch to non-root user
USER nestjs

# Expose port
EXPOSE 3001

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=40s \
  CMD node -e "require('http').get('http://localhost:3001/health', (r) => {process.exit(r.statusCode === 200 ? 0 : 1)})"

# Use dumb-init to handle signals properly
ENTRYPOINT ["dumb-init", "--"]

# Start the application
CMD ["node", "dist/main.js"]
```

### 4. Backend Dockerfile.dev (Development)

```dockerfile
# backend/Dockerfile.dev

FROM node:20-alpine

# Install dumb-init
RUN apk add --no-cache dumb-init

WORKDIR /app

# Copy package files
COPY package*.json ./

# Install dependencies
RUN npm install

# Copy source code (will be overridden by volume in dev)
COPY . .

# Expose ports
EXPOSE 3001 9229

# Use dumb-init
ENTRYPOINT ["dumb-init", "--"]

# Start in development mode with debugging
CMD ["npm", "run", "start:dev"]
```

### 5. Frontend Dockerfile (Production)

```dockerfile
# frontend/Dockerfile

# Stage 1: Dependencies
FROM node:20-alpine AS deps

WORKDIR /app

# Copy package files
COPY package*.json ./

# Install dependencies
RUN npm ci

# Stage 2: Builder
FROM node:20-alpine AS builder

WORKDIR /app

# Copy dependencies
COPY --from=deps /app/node_modules ./node_modules

# Copy source code
COPY . .

# Build arguments
ARG NEXT_PUBLIC_API_URL
ENV NEXT_PUBLIC_API_URL=$NEXT_PUBLIC_API_URL

# Disable telemetry during build
ENV NEXT_TELEMETRY_DISABLED=1

# Build the application
RUN npm run build

# Stage 3: Production
FROM node:20-alpine AS production

WORKDIR /app

# Set environment
ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1

# Create non-root user
RUN addgroup --system --gid 1001 nodejs && \
    adduser --system --uid 1001 nextjs

# Copy necessary files from builder
COPY --from=builder /app/public ./public
COPY --from=builder /app/package.json ./package.json

# Copy standalone build
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static

# Switch to non-root user
USER nextjs

# Expose port
EXPOSE 3000

ENV PORT=3000

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=40s \
  CMD node -e "require('http').get('http://localhost:3000', (r) => {process.exit(r.statusCode === 200 ? 0 : 1)})"

# Start the application
CMD ["node", "server.js"]
```

**Note:** For the standalone build to work, add this to your `next.config.js`:

```javascript
// frontend/next.config.js
module.exports = {
  output: 'standalone',
  // ... other config
}
```

### 6. Frontend Dockerfile.dev (Development)

```dockerfile
# frontend/Dockerfile.dev

FROM node:20-alpine

WORKDIR /app

# Copy package files
COPY package*.json ./

# Install dependencies
RUN npm install

# Copy source code (will be overridden by volume in dev)
COPY . .

# Expose port
EXPOSE 3000

# Start development server
CMD ["npm", "run", "dev"]
```

### 7. Environment Variables (.env.example)

```bash
# Database Configuration
POSTGRES_USER=myuser
POSTGRES_PASSWORD=mySecurePassword123
POSTGRES_DB=myapp_db
POSTGRES_PORT=5432

# NestJS Configuration
NESTJS_PORT=3001
JWT_SECRET=your-super-secret-jwt-key-change-in-production
CORS_ORIGIN=http://localhost:3000

# Next.js Configuration
NEXTJS_PORT=3000
NEXT_PUBLIC_API_URL=http://localhost:3001

# Optional: Additional configurations
# REDIS_URL=redis://redis:6379
# AWS_REGION=us-east-1
# AWS_ACCESS_KEY_ID=your-key
# AWS_SECRET_ACCESS_KEY=your-secret
```

### 8. .dockerignore Files

**Root .dockerignore:**
```
node_modules
npm-debug.log
.env
.env.local
.git
.gitignore
README.md
.vscode
.idea
```

**frontend/.dockerignore:**
```
node_modules
.next
npm-debug.log
.env*.local
.git
.gitignore
README.md
.vscode
.idea
out
```

**backend/.dockerignore:**
```
node_modules
dist
npm-debug.log
.env
.env.local
.git
.gitignore
README.md
.vscode
.idea
test
coverage
```

## Setup Instructions

### Initial Setup

1. **Clone or create your project structure:**
   ```bash
   mkdir -p project-root/{frontend,backend,init-scripts}
   cd project-root
   ```

2. **Create environment file:**
   ```bash
   cp .env.example .env
   # Edit .env with your actual values
   nano .env
   ```

3. **Set up Next.js (if not already done):**
   ```bash
   cd frontend
   npx create-next-app@latest .
   ```

4. **Set up NestJS (if not already done):**
   ```bash
   cd ../backend
   npx @nestjs/cli new .
   ```

5. **Update Next.js config for Docker:**
   Edit `frontend/next.config.js`:
   ```javascript
   module.exports = {
     output: 'standalone',
     // Add this for Docker networking
     async rewrites() {
       return [
         {
           source: '/api/:path*',
           destination: 'http://nestjs:3001/:path*',
         },
       ]
     },
   }
   ```

6. **Add health check endpoint to NestJS:**
   ```bash
   cd backend
   npm install @nestjs/terminus
   ```

   Create `backend/src/health/health.controller.ts`:
   ```typescript
   import { Controller, Get } from '@nestjs/common';
   import { HealthCheck, HealthCheckService } from '@nestjs/terminus';

   @Controller('health')
   export class HealthController {
     constructor(private health: HealthCheckService) {}

     @Get()
     @HealthCheck()
     check() {
       return this.health.check([]);
     }
   }
   ```

## Usage Commands

### Development Mode

```bash
# Start all services in development mode
docker-compose -f docker-compose.dev.yml up

# Start in detached mode (background)
docker-compose -f docker-compose.dev.yml up -d

# View logs
docker-compose -f docker-compose.dev.yml logs -f

# View logs for specific service
docker-compose -f docker-compose.dev.yml logs -f nextjs

# Stop all services
docker-compose -f docker-compose.dev.yml down

# Stop and remove volumes (WARNING: deletes database data)
docker-compose -f docker-compose.dev.yml down -v

# Rebuild after dependency changes
docker-compose -f docker-compose.dev.yml up --build

# Rebuild specific service
docker-compose -f docker-compose.dev.yml up --build nestjs
```

### Production Mode

```bash
# Build and start all services
docker-compose up -d

# View logs
docker-compose logs -f

# Stop services
docker-compose down

# Rebuild and restart
docker-compose up -d --build

# Scale a service (if needed)
docker-compose up -d --scale nextjs=3
```

### Database Management

```bash
# Access PostgreSQL CLI
docker exec -it postgres_db psql -U myuser -d myapp_db

# Backup database
docker exec postgres_db pg_dump -U myuser myapp_db > backup.sql

# Restore database
docker exec -i postgres_db psql -U myuser myapp_db < backup.sql

# View database logs
docker-compose logs -f postgres
```

### Container Management

```bash
# List running containers
docker-compose ps

# Execute command in container
docker-compose exec nestjs npm run migration:run

# Access container shell
docker-compose exec nestjs sh
docker-compose exec nextjs sh

# Restart specific service
docker-compose restart nestjs

# View resource usage
docker stats
```

## Production Deployment

### On EC2 or VPS

1. **Install Docker and Docker Compose:**
   ```bash
   # Update system
   sudo apt update && sudo apt upgrade -y

   # Install Docker
   curl -fsSL https://get.docker.com -o get-docker.sh
   sudo sh get-docker.sh

   # Install Docker Compose
   sudo curl -L "https://github.com/docker/compose/releases/latest/download/docker-compose-$(uname -s)-$(uname -m)" -o /usr/local/bin/docker-compose
   sudo chmod +x /usr/local/bin/docker-compose

   # Add user to docker group
   sudo usermod -aG docker $USER
   newgrp docker
   ```

2. **Clone your repository:**
   ```bash
   git clone your-repo-url
   cd your-repo
   ```

3. **Configure environment:**
   ```bash
   cp .env.example .env
   nano .env  # Update with production values
   ```

4. **Start services:**
   ```bash
   docker-compose up -d
   ```

5. **Set up reverse proxy (Nginx) - Optional but recommended:**
   ```nginx
   # /etc/nginx/sites-available/myapp
   server {
       listen 80;
       server_name yourdomain.com;

       location / {
           proxy_pass http://localhost:3000;
           proxy_http_version 1.1;
           proxy_set_header Upgrade $http_upgrade;
           proxy_set_header Connection 'upgrade';
           proxy_set_header Host $host;
           proxy_cache_bypass $http_upgrade;
       }

       location /api {
           proxy_pass http://localhost:3001;
           proxy_http_version 1.1;
           proxy_set_header Host $host;
           proxy_set_header X-Real-IP $remote_addr;
       }
   }
   ```

6. **Enable SSL with Let's Encrypt:**
   ```bash
   sudo apt install certbot python3-certbot-nginx
   sudo certbot --nginx -d yourdomain.com
   ```

### Using Docker Hub (Alternative)

1. **Build and push images:**
   ```bash
   # Login to Docker Hub
   docker login

   # Build images
   docker build -t yourusername/myapp-nextjs:latest ./frontend
   docker build -t yourusername/myapp-nestjs:latest ./backend

   # Push images
   docker push yourusername/myapp-nextjs:latest
   docker push yourusername/myapp-nestjs:latest
   ```

2. **Update docker-compose.yml to use remote images:**
   ```yaml
   services:
     nextjs:
       image: yourusername/myapp-nextjs:latest
       # Remove build section
   ```

## Troubleshooting

### Common Issues

**1. Port already in use:**
```bash
# Find process using port
sudo lsof -i :3000
# Kill process
sudo kill -9 <PID>
```

**2. Database connection refused:**
- Check if postgres container is healthy: `docker-compose ps`
- Verify DATABASE_URL in NestJS environment
- Check network connectivity: `docker-compose exec nestjs ping postgres`

**3. Hot reload not working in development:**
- Add `WATCHPACK_POLLING=true` to Next.js environment
- Ensure volumes are properly mounted

**4. Out of disk space:**
```bash
# Remove unused images and containers
docker system prune -a

# Remove volumes (WARNING: deletes data)
docker volume prune
```

**5. Container keeps restarting:**
```bash
# Check logs
docker-compose logs <service-name>

# Check container status
docker-compose ps
```

### Debugging

**View detailed logs:**
```bash
# All services
docker-compose logs -f --tail=100

# Specific service
docker-compose logs -f nestjs --tail=100
```

**Enter container for debugging:**
```bash
docker-compose exec nestjs sh
# Now you're inside the container
ps aux
env
netstat -tlnp
```

**Check network connectivity:**
```bash
docker-compose exec nestjs ping postgres
docker-compose exec nextjs wget http://nestjs:3001/health
```

## Best Practices

1. **Security:**
   - Never commit `.env` file
   - Use strong passwords in production
   - Keep images updated
   - Run containers as non-root users
   - Use secrets management for sensitive data

2. **Performance:**
   - Use multi-stage builds to reduce image size
   - Leverage Docker layer caching
   - Use Alpine images where possible
   - Implement health checks

3. **Development:**
   - Use separate dev/prod configurations
   - Mount volumes for hot reload
   - Use `.dockerignore` to exclude unnecessary files

4. **Monitoring:**
   - Implement logging aggregation
   - Set up health checks
   - Monitor resource usage
   - Use Docker's restart policies

5. **Backups:**
   - Regular database backups
   - Version control for configurations
   - Document your setup

## Next Steps

- [ ] Set up CI/CD pipeline (GitHub Actions, GitLab CI)
- [ ] Add Redis for caching
- [ ] Implement log aggregation (ELK stack)
- [ ] Set up monitoring (Prometheus + Grafana)
- [ ] Configure automated backups
- [ ] Add integration tests
- [ ] Set up staging environment
