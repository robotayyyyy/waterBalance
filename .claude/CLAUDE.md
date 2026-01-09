# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

WaterF is a full-stack watershed management system for visualizing and analyzing river basins using PostGIS spatial queries. The application serves GeoJSON data through a NestJS API and renders interactive maps with Leaflet in a Next.js frontend.

## Core Architecture

### Three-Layer Stack

1. **PostgreSQL + PostGIS** - Spatial database with GIST-indexed geometry columns
2. **NestJS Backend** - RESTful API with direct PostgreSQL Pool connections (no ORM)
3. **Next.js Frontend** - React 19 with Leaflet for mapping

### Database Connection Pattern

The backend uses **raw PostgreSQL connections via `pg` Pool**, not TypeORM or Prisma. All spatial queries are written as SQL with PostGIS functions:

- Connection pool initialized in `GeoService.onModuleInit()`
- Environment variables: `DATABASE_HOST`, `DATABASE_PORT`, `DATABASE_USER`, `DATABASE_PASSWORD`, `DATABASE_NAME`
- All queries use `ST_AsGeoJSON()` to convert PostGIS geometries to GeoJSON
- Queries use `ST_GeomFromGeoJSON()` for inserts, `ST_GeomFromText()` for WKT input

### GeoJSON Response Format

All API endpoints return RFC 7946 GeoJSON FeatureCollections:

```typescript
{
  type: 'FeatureCollection',
  features: [
    {
      type: 'Feature',
      id: number,
      geometry: { type: 'LineString' | 'Polygon', coordinates: [...] },
      properties: { name, river_order?, area_km2?, ... }
    }
  ]
}
```

### Spatial Tables Schema

**rivers**: `id`, `name`, `geometry (LINESTRING, 4326)`, `river_order`, `length_km`, `metadata (JSONB)`
**basins**: `id`, `name`, `geometry (POLYGON, 4326)`, `area_km2`, `metadata (JSONB)`

Both have GIST spatial indexes on `geometry` and B-tree indexes on `name`.

## Development Commands

### Local Development (Recommended)

```bash
# Start PostgreSQL only
docker-compose up -d postgres

# Terminal 2: Backend dev mode
cd backend
npm run start:dev

# Terminal 3: Frontend dev mode
cd frontend
npm run dev
```

Frontend: http://localhost:3000
Backend API: http://localhost:3001
Map interface: http://localhost:3000/map

### Full Docker Stack

```bash
# Build and run all services (postgres, nestjs, nextjs, nginx)
docker-compose up --build

# Access via Nginx proxy
# Frontend: http://localhost
# Backend: http://localhost/api (proxied to nestjs:3001)
```

### Backend Commands

```bash
cd backend
npm run build          # Compile TypeScript
npm run start:dev      # Watch mode with hot reload
npm run start:prod     # Production mode (requires build first)
npm run lint           # ESLint with auto-fix
npm run test           # Run Jest unit tests
npm run test:watch     # Jest watch mode
npm run test:e2e       # End-to-end tests
```

### Frontend Commands

```bash
cd frontend
npm run dev            # Next.js dev server (port 3000)
npm run build          # Production build
npm run start          # Serve production build
npm run lint           # ESLint check
```

### Database Operations

```bash
# Connect to PostgreSQL
docker exec -it postgres_db psql -U postgres -d postgres

# Check PostGIS version
docker exec -it postgres_db psql -U postgres -c "SELECT PostGIS_Version();"

# View tables
docker exec -it postgres_db psql -U postgres -c "\dt"

# Query data
docker exec -it postgres_db psql -U postgres -c "SELECT name, ST_AsText(geometry) FROM rivers;"

# Rebuild database (drops all data)
docker-compose down -v
docker-compose up -d postgres
# Wait 10 seconds for init-scripts/01-geo-tables.sql to run
```

## Key Implementation Patterns

### Adding New Spatial Queries

1. **Write the PostGIS SQL** in `backend/src/geo/geo.service.ts`:
   ```typescript
   async findRiversInBasin(basinId: number) {
     const result = await this.pool.query(`
       SELECT r.id, r.name, ST_AsGeoJSON(r.geometry)::json as geometry
       FROM rivers r
       JOIN basins b ON ST_Intersects(r.geometry, b.geometry)
       WHERE b.id = $1
     `, [basinId]);

     return {
       type: 'FeatureCollection',
       features: result.rows.map(row => ({
         type: 'Feature',
         id: row.id,
         geometry: row.geometry,
         properties: { name: row.name }
       }))
     };
   }
   ```

2. **Add controller endpoint** in `backend/src/geo/geo.controller.ts`:
   ```typescript
   @Get('basins/:id/rivers')
   async getRiversInBasin(@Param('id') id: string) {
     return this.geoService.findRiversInBasin(parseInt(id));
   }
   ```

### Bounding Box Filtering

API endpoints support `?bbox=minLon,minLat,maxLon,maxLat` for viewport optimization:

```sql
WHERE geometry && ST_MakeEnvelope($1, $2, $3, $4, 4326)
```

The `&&` operator uses the GIST index for fast spatial filtering.

### Frontend Map Integration

- Map component: `frontend/app/map/MapComponent.tsx`
- Uses React-Leaflet with `<GeoJSON>` components
- API URL from `process.env.NEXT_PUBLIC_API_URL`
- Layer toggling via local state
- Auto-fit bounds with `FitBounds` custom hook component
- Styling based on feature properties (e.g., river_order affects line width)

### Nginx Proxy Routing

In Docker mode, Nginx routes:
- `/` → Next.js (port 3000)
- `/api/*` → NestJS (rewrites to remove `/api` prefix, proxies to port 3001)

The backend controller uses `@Controller('api/geo')` so full paths are `/api/geo/rivers`, etc.

## Environment Configuration

Copy `.env.example` to `.env` and adjust:

**Critical variables:**
- `POSTGRES_USER`, `POSTGRES_PASSWORD`, `POSTGRES_DB` - Database credentials
- `CORS_ORIGIN` - Frontend URL (dev: `http://localhost:3000`, prod: your domain)
- `NEXT_PUBLIC_API_URL` - Backend URL (dev: `http://localhost:3001`, Docker: `http://localhost/api`)
- `JWT_SECRET` - Change in production

## Data Import Methods

### SQL Insert

```sql
INSERT INTO rivers (name, geometry) VALUES (
  'River Name',
  ST_GeomFromText('LINESTRING(-97.7 30.2, -97.6 30.3)', 4326)
);
```

### Shapefile Import

```bash
docker cp data.shp postgres_db:/tmp/
docker exec -it postgres_db bash
apt-get update && apt-get install -y gdal-bin
shp2pgsql -I -s 4326 /tmp/data.shp public.rivers | psql -U postgres -d postgres
```

### API Import

```bash
curl -X POST http://localhost:3001/api/geo/rivers \
  -H "Content-Type: application/json" \
  -d '{
    "name": "New River",
    "geometry": {
      "type": "LineString",
      "coordinates": [[-97.7, 30.2], [-97.6, 30.3]]
    }
  }'
```

## Common PostGIS Functions

- `ST_AsGeoJSON(geometry)` - Convert to GeoJSON (always use `::json` cast)
- `ST_GeomFromGeoJSON(text)` - Parse GeoJSON to geometry
- `ST_GeomFromText(wkt, srid)` - Parse WKT to geometry
- `ST_Contains(polygon, point)` - Point-in-polygon test
- `ST_Intersects(geom1, geom2)` - Spatial intersection test
- `ST_Length(geography)` - Length in meters (use `::geography` cast)
- `ST_Area(geography)` - Area in square meters (use `::geography` cast)
- `ST_MakeEnvelope(xmin, ymin, xmax, ymax, srid)` - Create bounding box
- `&&` operator - Bounding box overlap (uses GIST index)

## Code Organization

### Backend Structure

```
backend/src/
├── geo/
│   ├── geo.module.ts      # Module definition
│   ├── geo.controller.ts  # REST endpoints (@Controller('api/geo'))
│   └── geo.service.ts     # PostGIS queries with Pool
├── app.module.ts          # Root module (imports GeoModule)
├── app.controller.ts      # Health check endpoint
└── main.ts                # Bootstrap with CORS config
```

### Frontend Structure

```
frontend/app/
├── map/
│   ├── page.tsx           # Map route wrapper
│   └── MapComponent.tsx   # Leaflet map with GeoJSON layers
├── page.tsx               # Home page with link to /map
├── layout.tsx             # Root layout with metadata
└── globals.css            # Tailwind imports
```

### Init Scripts

`init-scripts/01-geo-tables.sql` runs once when PostgreSQL container first starts:
- Enables PostGIS extension
- Creates `rivers` and `basins` tables
- Creates GIST and B-tree indexes
- Inserts test data (Central Texas area)
- Calculates lengths/areas

## SWAT+ Integration Notes

For future SWAT+ model integration, the existing structure supports:
- Subbasin geometries (use `basins` table or create `swat_subbasins`)
- Channel networks (use `rivers` table or create `swat_channels`)
- HRU polygons (create new table with `MULTIPOLYGON` geometry)
- Model outputs via `metadata` JSONB columns or time-series tables

Recommended approach: Add new tables for SWAT-specific entities, link via foreign keys to `basins`/`rivers`, store time-varying outputs in separate tables with `timestamp` columns.
