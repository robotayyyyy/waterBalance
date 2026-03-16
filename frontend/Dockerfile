# Stage 1: Dependencies
FROM node:20-alpine AS deps

WORKDIR /app

# Copy package files from frontend folder
COPY frontend/package*.json ./

# Install dependencies
RUN npm ci

# Stage 2: Builder
FROM node:20-alpine AS builder

WORKDIR /app

# Build-time env vars for NEXT_PUBLIC_* (baked into JS bundle)
ARG NEXT_PUBLIC_API_URL=/api
ARG NEXT_PUBLIC_PMTILES_ADM1_URL=/thaimap/tha-province.pmtiles
ARG NEXT_PUBLIC_PMTILES_ADM2_URL=/thaimap/tha-amphoe.pmtiles
ARG NEXT_PUBLIC_PMTILES_ADM3_URL=/thaimap/tha-tambon.pmtiles
ARG NEXT_PUBLIC_PROTOMAPS_KEY
ARG NEXT_PUBLIC_MAPTILER_KEY

ENV NEXT_PUBLIC_API_URL=$NEXT_PUBLIC_API_URL
ENV NEXT_PUBLIC_PMTILES_ADM1_URL=$NEXT_PUBLIC_PMTILES_ADM1_URL
ENV NEXT_PUBLIC_PMTILES_ADM2_URL=$NEXT_PUBLIC_PMTILES_ADM2_URL
ENV NEXT_PUBLIC_PMTILES_ADM3_URL=$NEXT_PUBLIC_PMTILES_ADM3_URL
ENV NEXT_PUBLIC_PROTOMAPS_KEY=$NEXT_PUBLIC_PROTOMAPS_KEY
ENV NEXT_PUBLIC_MAPTILER_KEY=$NEXT_PUBLIC_MAPTILER_KEY

# Copy dependencies
COPY --from=deps /app/node_modules ./node_modules

# Copy frontend source code
COPY frontend/ .

# Set build environment
ENV NODE_ENV=production
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
ENV HOSTNAME=0.0.0.0

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=40s \
  CMD node -e "require('http').get('http://localhost:3000', (r) => {process.exit(r.statusCode === 200 ? 0 : 1)})"

# Start the application
CMD ["node", "server.js"]
