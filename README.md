# WaterF - Watershed Management System

A full-stack web application for visualizing and managing watershed basins and river networks with interactive mapping and spatial analysis.

## Features

- Interactive map visualization of rivers and watershed basins
- PostGIS-powered spatial queries and analysis
- Real-time layer toggling (basins, rivers)
- Hover effects and popups with detailed information
- Auto-fitting map bounds to data
- RESTful API for geospatial data

## Tech Stack

**Frontend:**
- Next.js 16 (React 19)
- Leaflet & React-Leaflet (mapping)
- TypeScript
- TailwindCSS

**Backend:**
- NestJS
- PostgreSQL + PostGIS
- Node.js
- TypeScript

**Infrastructure:**
- Docker & Docker Compose
- Nginx (reverse proxy)

## Project Structure

```
waterF/
├── backend/              # NestJS API
│   └── src/
│       ├── geo/         # Geospatial module
│       │   ├── geo.module.ts
│       │   ├── geo.controller.ts
│       │   └── geo.service.ts
│       ├── app.module.ts
│       └── main.ts
├── frontend/            # Next.js app
│   └── app/
│       ├── map/        # Map page
│       │   ├── page.tsx
│       │   └── MapComponent.tsx
│       └── page.tsx    # Home page
├── init-scripts/       # Database initialization
│   └── 01-geo-tables.sql
├── docker-compose.yml
└── nginx.conf
```

## Getting Started

### Prerequisites

- Docker and Docker Compose `sudo apt update && sudo apt install docker.io docker-compose -y`
- Node.js 20+ (for local development) `sudo apt install nodejs`
- symlink npm to npmjs if needed `sudo ln -s .env ./backend/.env && sudo ln -s .env ./frontend/.env`
- Add your user to the docker group `sudo usermod -aG docker $USER`
- Activate the group (or log out/in) `newgrp docker`

### Installation

1. **Clone the repository** (if not already done)

2. **Create environment file**
   ```bash
   cp .env.example .env
   ```

3. **Install dependencies locally** (optional, for development)
   ```bash
   # Backend
   cd backend
   npm install

   # Frontend
   cd ../frontend
   npm install
   ```

### Running with Docker

```bash
# Start all services
docker-compose up -d

# View logs
docker-compose logs -f

# Stop all services
docker-compose down
```

The application will be available at:
- **Frontend**: http://localhost (Nginx)
- **Backend API**: http://localhost:3001
- **PostgreSQL**: localhost:5432

### Running Locally (Development)

1. **Start PostgreSQL only**
   ```bash
   docker-compose up -d postgres
   ```

2. **Run backend**
   ```bash
   cd backend
   npm run start:dev
   ```

3. **Run frontend**
   ```bash
   cd frontend
   npm run dev
   ```

Visit http://localhost:3000 to see the application.

## API Endpoints

### Rivers

- `GET /api/geo/rivers` - Get all rivers (with optional bbox filter)
- `GET /api/geo/rivers/:id` - Get single river by ID
- `POST /api/geo/rivers` - Create new river

**Query Parameters:**
- `bbox` - Bounding box filter: `minLon,minLat,maxLon,maxLat`

**Example:**
```bash
curl http://localhost:3001/api/geo/rivers
curl http://localhost:3001/api/geo/rivers?bbox=-98,30,-96,32
```

### Basins

- `GET /api/geo/basins` - Get all basins (with optional bbox filter)
- `GET /api/geo/basins/:id` - Get single basin by ID
- `POST /api/geo/basins` - Create new basin
- `POST /api/geo/basins/find-by-point` - Find basin containing a point

**Example:**
```bash
curl http://localhost:3001/api/geo/basins
curl -X POST http://localhost:3001/api/geo/basins/find-by-point \
  -H "Content-Type: application/json" \
  -d '{"lon": -97.7, "lat": 30.3}'
```

### Response Format

All geospatial endpoints return GeoJSON FeatureCollection:

```json
{
  "type": "FeatureCollection",
  "features": [
    {
      "type": "Feature",
      "id": 1,
      "geometry": {
        "type": "LineString",
        "coordinates": [[-97.7431, 30.2672], [-97.7200, 30.2800]]
      },
      "properties": {
        "name": "Colorado River",
        "river_order": 3,
        "length_km": 5.2
      }
    }
  ]
}
```

## Database Schema

### Rivers Table
```sql
CREATE TABLE rivers (
    id SERIAL PRIMARY KEY,
    name VARCHAR(255),
    geometry GEOMETRY(LINESTRING, 4326),
    river_order INTEGER,
    length_km NUMERIC(10,2),
    metadata JSONB,
    created_at TIMESTAMP DEFAULT NOW()
);
```

### Basins Table
```sql
CREATE TABLE basins (
    id SERIAL PRIMARY KEY,
    name VARCHAR(255),
    geometry GEOMETRY(POLYGON, 4326),
    area_km2 NUMERIC(10,2),
    metadata JSONB,
    created_at TIMESTAMP DEFAULT NOW()
);
```

## Importing Custom Data

### Option 1: Using SQL

```sql
-- Insert river (LINESTRING)
INSERT INTO rivers (name, geometry) VALUES (
    'My River',
    ST_GeomFromText('LINESTRING(-97.7 30.2, -97.6 30.3)', 4326)
);

-- Insert basin (POLYGON)
INSERT INTO basins (name, geometry) VALUES (
    'My Basin',
    ST_GeomFromText('POLYGON((-97.8 30.1, -97.4 30.1, -97.4 30.5, -97.8 30.5, -97.8 30.1))', 4326)
);
```

### Option 2: Using Shapefiles

```bash
# Copy shapefile into container
docker cp rivers.shp postgres_db:/tmp/

# Import to database
docker exec -it postgres_db bash
apt-get update && apt-get install -y gdal-bin
shp2pgsql -I -s 4326 /tmp/rivers.shp public.rivers | psql -U postgres -d postgres
```

### Option 3: Using API

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

## Map Features

### Layer Controls
- Toggle basins and rivers on/off
- View feature counts

### Interactive Features
- Click on features to see details
- Hover to highlight
- Auto-zoom to fit all data

### Styling
- Rivers: Width based on stream order
- Basins: Semi-transparent blue polygons
- Hover effects for better UX

## Development

### Adding New Spatial Queries

1. Add method to `geo.service.ts`:
```typescript
async getRiversInBasin(basinId: number) {
  const result = await this.pool.query(`
    SELECT r.*, ST_AsGeoJSON(r.geometry)::json as geometry
    FROM rivers r
    JOIN basins b ON ST_Intersects(r.geometry, b.geometry)
    WHERE b.id = $1
  `, [basinId]);

  return { type: 'FeatureCollection', features: ... };
}
```

2. Add endpoint to `geo.controller.ts`:
```typescript
@Get('basins/:basinId/rivers')
async getRiversInBasin(@Param('basinId') basinId: string) {
  return this.geoService.getRiversInBasin(parseInt(basinId));
}
```

### Useful PostGIS Functions

```sql
-- Calculate length
SELECT ST_Length(geometry::geography) / 1000 as km FROM rivers;

-- Calculate area
SELECT ST_Area(geometry::geography) / 1000000 as km2 FROM basins;

-- Check if point is in basin
SELECT * FROM basins WHERE ST_Contains(geometry, ST_Point(-97.7, 30.3, 4326));

-- Find intersecting features
SELECT * FROM rivers r, basins b WHERE ST_Intersects(r.geometry, b.geometry);

-- Buffer around river (500m)
SELECT ST_Buffer(geometry::geography, 500)::geometry FROM rivers;

-- Simplify geometry (reduce vertices)
SELECT ST_Simplify(geometry, 0.001) FROM rivers;
```

## Troubleshooting

### Map doesn't load
1. Check backend is running: `curl http://localhost:3001/health`
2. Check database connection: `docker-compose logs postgres`
3. Verify PostGIS: `docker exec -it postgres_db psql -U postgres -c "SELECT PostGIS_Version();"`

### No data showing
1. Verify data exists: `docker exec -it postgres_db psql -U postgres -c "SELECT COUNT(*) FROM rivers;"`
2. Check API response: `curl http://localhost:3001/api/geo/rivers`
3. Check browser console for errors

### CORS errors
- Ensure NEXT_PUBLIC_API_URL matches your backend URL
- Check CORS_ORIGIN in docker-compose.yml

## Next Steps

### Recommended Extensions

1. **Search & Filter**
   - Add search bar for rivers/basins by name
   - Filter by stream order, area, etc.

2. **Drawing Tools**
   - Add Leaflet Draw for creating new features
   - Interactive geometry editing

3. **Data Export**
   - Export to GeoJSON, Shapefile, KML
   - Generate reports

4. **Advanced Queries**
   - Find upstream/downstream features
   - Calculate watershed properties
   - Distance measurements

5. **SWAT+ Integration**
   - Import SWAT+ model outputs
   - Visualize HRUs, subbasins
   - Display model results

## Resources

- [PostGIS Documentation](https://postgis.net/documentation/)
- [Leaflet Documentation](https://leafletjs.com/)
- [NestJS Documentation](https://docs.nestjs.com/)
- [Next.js Documentation](https://nextjs.org/docs)
- [GeoJSON Specification](https://datatracker.ietf.org/doc/html/rfc7946)

## License

UNLICENSED - Private project
