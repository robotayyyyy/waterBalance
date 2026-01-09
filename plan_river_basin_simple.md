# River and Basin Mapping - Solo Developer Plan

**Philosophy**: Start simple, extend when needed. Working feature > perfect architecture.

---

## Tech Stack (Simplified)

```
Frontend:  Leaflet (no API key, easy)
Backend:   NestJS REST API (already set up)
Database:  PostGIS (already running)
Format:    GeoJSON (standard, simple)
```

---

## Phase 1: Minimum Viable Map (2-3 hours)

### Step 1: Database (30 min)

```sql
-- Enable PostGIS (run once)
CREATE EXTENSION IF NOT EXISTS postgis;

-- Simple tables
CREATE TABLE rivers (
    id SERIAL PRIMARY KEY,
    name VARCHAR(255),
    geometry GEOMETRY(LINESTRING, 4326)
);

CREATE TABLE basins (
    id SERIAL PRIMARY KEY,
    name VARCHAR(255),
    geometry GEOMETRY(POLYGON, 4326)
);

-- Spatial indexes (critical for performance)
CREATE INDEX idx_rivers_geom ON rivers USING GIST(geometry);
CREATE INDEX idx_basins_geom ON basins USING GIST(geometry);

-- Test data (draw a simple river)
INSERT INTO rivers (name, geometry) VALUES (
    'Test River',
    ST_GeomFromText('LINESTRING(-97.7 30.2, -97.6 30.3, -97.5 30.4)', 4326)
);

-- Test basin (simple polygon)
INSERT INTO basins (name, geometry) VALUES (
    'Test Basin',
    ST_GeomFromText('POLYGON((-97.8 30.1, -97.4 30.1, -97.4 30.5, -97.8 30.5, -97.8 30.1))', 4326)
);
```

### Step 2: Backend API (1 hour)

```typescript
// backend/src/rivers/rivers.controller.ts
import { Controller, Get } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';

@Controller('api/geo')
export class GeoController {
  constructor(
    @Inject('DATABASE_CONNECTION') private db: any
  ) {}

  // Simple approach: raw SQL queries
  @Get('rivers')
  async getRivers() {
    const result = await this.db.query(`
      SELECT
        id,
        name,
        ST_AsGeoJSON(geometry)::json as geometry
      FROM rivers
    `);

    return {
      type: 'FeatureCollection',
      features: result.map(row => ({
        type: 'Feature',
        id: row.id,
        geometry: row.geometry,
        properties: { name: row.name }
      }))
    };
  }

  @Get('basins')
  async getBasins() {
    const result = await this.db.query(`
      SELECT
        id,
        name,
        ST_AsGeoJSON(geometry)::json as geometry
      FROM basins
    `);

    return {
      type: 'FeatureCollection',
      features: result.map(row => ({
        type: 'Feature',
        id: row.id,
        geometry: row.geometry,
        properties: { name: row.name }
      }))
    };
  }
}
```

### Step 3: Frontend Map (1 hour)

```bash
cd frontend
npm install leaflet react-leaflet
npm install -D @types/leaflet
```

```tsx
// frontend/app/map/page.tsx
'use client';
import { MapContainer, TileLayer, GeoJSON } from 'react-leaflet';
import { useEffect, useState } from 'react';
import 'leaflet/dist/leaflet.css';

export default function MapPage() {
  const [rivers, setRivers] = useState(null);
  const [basins, setBasins] = useState(null);

  useEffect(() => {
    // Fetch from your API
    fetch('http://localhost:3001/api/geo/rivers')
      .then(r => r.json())
      .then(setRivers);

    fetch('http://localhost:3001/api/geo/basins')
      .then(r => r.json())
      .then(setBasins);
  }, []);

  return (
    <div style={{ height: '100vh', width: '100%' }}>
      <MapContainer
        center={[30.3, -97.7]}  // Adjust to your area
        zoom={10}
        style={{ height: '100%', width: '100%' }}
      >
        <TileLayer
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          attribution='&copy; OpenStreetMap'
        />

        {basins && (
          <GeoJSON
            data={basins}
            style={{ fillColor: '#3388ff', fillOpacity: 0.2, color: '#3388ff', weight: 2 }}
          />
        )}

        {rivers && (
          <GeoJSON
            data={rivers}
            style={{ color: '#0066cc', weight: 3 }}
          />
        )}
      </MapContainer>
    </div>
  );
}
```

**Result**: Working map with rivers and basins in ~2-3 hours.

---

## Phase 2: Essential Features (extend as needed)

### Add Popups/Labels
```tsx
<GeoJSON
  data={rivers}
  onEachFeature={(feature, layer) => {
    layer.bindPopup(`<b>${feature.properties.name}</b>`);
  }}
/>
```

### Add Import Endpoint (for shapefiles)
```typescript
// backend/src/geo/geo.controller.ts
@Post('import/rivers')
@UseInterceptors(FileInterceptor('file'))
async importRivers(@UploadedFile() file: Express.Multer.File) {
  // Use ogr2ogr via child_process
  execSync(`ogr2ogr -f PostgreSQL PG:"..." ${file.path}`);
  return { success: true };
}
```

### Add Drawing Tools (when needed)
```bash
npm install react-leaflet-draw
npm install -D @types/leaflet-draw
```

```tsx
import { FeatureGroup } from 'react-leaflet';
import { EditControl } from 'react-leaflet-draw';

<FeatureGroup>
  <EditControl
    onCreated={(e) => {
      const geojson = e.layer.toGeoJSON();
      fetch('/api/geo/rivers', {
        method: 'POST',
        body: JSON.stringify(geojson)
      });
    }}
  />
</FeatureGroup>
```

---

## Data Import Options (Choose One)

### Option 1: Manual GeoJSON Upload
Create rivers.geojson, paste into DB:
```sql
INSERT INTO rivers (name, geometry)
SELECT
  feature->>'name',
  ST_GeomFromGeoJSON(feature->>'geometry')
FROM json_array_elements('[your geojson features]'::json) AS feature;
```

### Option 2: Shapefile Import
```bash
# If you have .shp files from SWAT+ or GIS software
docker exec -it postgres_db bash
apt-get update && apt-get install -y gdal-bin

shp2pgsql -I -s 4326 rivers.shp public.rivers | psql -U postgres -d postgres
```

### Option 3: Draw Manually
- Use Leaflet Draw tools in browser
- POST to API to save

---

## Extension Points (Add Later)

### When you need performance:
```sql
-- Add bounding box filter
WHERE geometry && ST_MakeEnvelope($1, $2, $3, $4, 4326)
```

### When you need search:
```sql
-- Find river by name
WHERE name ILIKE '%colorado%'

-- Find basin containing point
WHERE ST_Contains(geometry, ST_Point($1, $2, 4326))
```

### When you need calculations:
```sql
-- River length
SELECT ST_Length(geometry::geography) / 1000 as km

-- Basin area
SELECT ST_Area(geometry::geography) / 1000000 as km2
```

### When you need more data:
- Add `river_order`, `flow_rate`, `upstream_area` columns
- Add monitoring_points table (POINT geometry)
- Add relationships: `basin_id` foreign key

---

## File Structure

```
waterF/
├── backend/
│   └── src/
│       └── geo/
│           ├── geo.module.ts
│           ├── geo.controller.ts      # Simple REST endpoints
│           └── geo.service.ts         # SQL queries (if needed)
├── frontend/
│   └── app/
│       └── map/
│           └── page.tsx               # Map component
└── init-scripts/
    └── 01-create-geo-tables.sql       # Run on DB startup
```

---

## Starting Point (Copy-Paste Ready)

### 1. Create migration file
```sql
-- init-scripts/01-geo-tables.sql
CREATE EXTENSION IF NOT EXISTS postgis;

CREATE TABLE rivers (
    id SERIAL PRIMARY KEY,
    name VARCHAR(255),
    geometry GEOMETRY(LINESTRING, 4326),
    created_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE basins (
    id SERIAL PRIMARY KEY,
    name VARCHAR(255),
    geometry GEOMETRY(POLYGON, 4326),
    created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_rivers_geom ON rivers USING GIST(geometry);
CREATE INDEX idx_basins_geom ON basins USING GIST(geometry);
```

### 2. Restart database
```bash
docker-compose down
docker-compose up -d postgres
```

### 3. Add geo module to NestJS
```bash
cd backend
nest g module geo
nest g controller geo
```

### 4. Install frontend deps
```bash
cd frontend
npm install leaflet react-leaflet
```

### 5. Build and test
```bash
docker-compose up --build
# Visit http://localhost/map
```

---

## Key Principles

1. **Start with raw SQL** - TypeORM entities can come later
2. **Use Leaflet** - No API keys, works everywhere
3. **GeoJSON everywhere** - Standard format, works with everything
4. **Test with simple data** - Draw a line, see it render
5. **Extend gradually** - Add features only when needed

---

## Common Gotchas

**Coordinates are backwards**: GeoJSON uses `[lon, lat]`, not `[lat, lon]`

**Map doesn't show**: Check CORS, check coordinates are in view, check browser console

**Empty response**: PostGIS extension not enabled, check with `SELECT PostGIS_Version();`

**Performance slow**: Add spatial indexes (`CREATE INDEX ... USING GIST`)

---

## What Success Looks Like

Week 1: Map shows test rivers and basins
Week 2: Import real data from shapefile/SWAT+
Week 3: Add drawing tools and labels
Week 4: Add search, calculations, export

Keep it simple, ship features, extend when needed.
