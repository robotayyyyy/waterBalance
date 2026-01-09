# Quick Setup Guide

## What Was Implemented

1. **Database Layer** - PostGIS tables for rivers and basins with test data
2. **Backend API** - NestJS endpoints serving GeoJSON data
3. **Frontend Map** - Interactive Leaflet map with layer controls
4. **Integration** - Full stack connected and ready to run

## Next Steps (Before Docker Build)

### 1. Install Dependencies

```bash
# Backend dependencies
cd backend
npm install

# Frontend dependencies
cd ../frontend
npm install
```

### 2. Test Database Script (Optional)

```bash
# Start only PostgreSQL to test the init script
docker-compose up -d postgres

# Check if tables were created
docker exec -it postgres_db psql -U postgres -d postgres -c "\dt"

# Verify data
docker exec -it postgres_db psql -U postgres -d postgres -c "SELECT name FROM rivers;"

# Stop postgres when done testing
docker-compose down
```

### 3. Local Development (Without Docker)

```bash
# Terminal 1: Start PostgreSQL only
docker-compose up -d postgres

# Terminal 2: Run backend
cd backend
npm run start:dev
# Should see: "PostGIS connected" and "Application is running on: http://localhost:3001"

# Terminal 3: Run frontend
cd frontend
npm run dev
# Visit http://localhost:3000

# Test the map at http://localhost:3000/map
```

### 4. Verify Everything Works

Test the API:
```bash
# Health check
curl http://localhost:3001/health

# Get rivers
curl http://localhost:3001/api/geo/rivers

# Get basins
curl http://localhost:3001/api/geo/basins
```

Expected response:
```json
{
  "type": "FeatureCollection",
  "features": [...]
}
```

### 5. View the Map

1. Go to http://localhost:3000
2. Click "View Basin Map"
3. You should see:
   - Blue polygons (basins)
   - Blue lines (rivers)
   - Layer controls (top right)
   - Map title (top left)

### 6. When Ready to Build Docker

```bash
# Build and start all services
docker-compose up --build

# The app will be available at:
# - Frontend: http://localhost (via Nginx)
# - Backend: http://localhost:3001
# - Database: localhost:5432
```

## File Structure Overview

```
waterF/
├── init-scripts/
│   └── 01-geo-tables.sql          # Creates tables + test data
├── backend/
│   ├── package.json               # Added: pg, @types/pg
│   └── src/
│       ├── geo/                   # NEW: Geo module
│       │   ├── geo.module.ts
│       │   ├── geo.controller.ts  # API endpoints
│       │   └── geo.service.ts     # PostGIS queries
│       ├── app.module.ts          # Updated: imports GeoModule
│       ├── app.controller.ts      # Updated: /health endpoint
│       └── main.ts                # Updated: CORS, port 3001
├── frontend/
│   ├── package.json               # Added: leaflet, react-leaflet
│   └── app/
│       ├── map/                   # NEW: Map page
│       │   ├── page.tsx
│       │   └── MapComponent.tsx   # Leaflet map component
│       └── page.tsx               # Updated: link to map
├── README.md                      # Full documentation
└── SETUP.md                       # This file
```

## Common Issues

### Backend won't start
```bash
cd backend
npm install  # Make sure pg is installed
```

### Frontend build errors
```bash
cd frontend
npm install  # Make sure leaflet and react-leaflet are installed
```

### Map shows error
- Check backend is running: `curl http://localhost:3001/api/geo/rivers`
- Check NEXT_PUBLIC_API_URL in frontend/.env (if you created one)
- Check browser console for CORS errors

### Database tables not created
```bash
# Recreate from scratch
docker-compose down -v  # -v removes volumes
docker-compose up -d postgres
# Wait 10 seconds for init script to run
docker exec -it postgres_db psql -U postgres -c "SELECT COUNT(*) FROM rivers;"
```

## What's Included (Test Data)

The database is pre-loaded with test data for Central Texas area:

**Rivers:**
- Colorado River (stream order 3)
- Tributary Creek (stream order 1)

**Basins:**
- Upper Colorado Basin
- Lower Colorado Basin

**Location:** Centered around Austin, TX (-97.7°, 30.3°)

You can replace this with your own data using the methods in README.md.

## Ready to Go!

Once dependencies are installed, you can:
1. Run locally with `docker-compose up -d postgres && cd backend && npm run start:dev`
2. Or build full Docker stack with `docker-compose up --build`

The system is fully implemented and ready for use!
