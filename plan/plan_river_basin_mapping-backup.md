# River and Basin Mapping - Technical Implementation Plan

## Overview
Draw rivers and watershed basins on an interactive web map with spatial querying capabilities.

---

## 1. Data Model (PostGIS)

### Database Schema

```sql
-- Rivers/Streams table
CREATE TABLE rivers (
    id SERIAL PRIMARY KEY,
    name VARCHAR(255),
    river_order INTEGER,           -- Strahler stream order
    length_km NUMERIC(10,2),
    geometry GEOMETRY(LINESTRING, 4326),  -- WGS84 coordinate system
    basin_id INTEGER REFERENCES basins(id),
    metadata JSONB,
    created_at TIMESTAMP DEFAULT NOW()
);

-- Watershed basins table
CREATE TABLE basins (
    id SERIAL PRIMARY KEY,
    name VARCHAR(255),
    area_km2 NUMERIC(10,2),
    geometry GEOMETRY(POLYGON, 4326),     -- or MULTIPOLYGON
    parent_basin_id INTEGER REFERENCES basins(id),  -- hierarchical basins
    metadata JSONB,
    created_at TIMESTAMP DEFAULT NOW()
);

-- Monitoring points (optional)
CREATE TABLE monitoring_points (
    id SERIAL PRIMARY KEY,
    name VARCHAR(255),
    type VARCHAR(50),              -- gauge, quality, rainfall
    geometry GEOMETRY(POINT, 4326),
    river_id INTEGER REFERENCES rivers(id),
    basin_id INTEGER REFERENCES basins(id),
    metadata JSONB,
    created_at TIMESTAMP DEFAULT NOW()
);

-- Spatial indexes (critical for performance)
CREATE INDEX idx_rivers_geometry ON rivers USING GIST(geometry);
CREATE INDEX idx_basins_geometry ON basins USING GIST(geometry);
CREATE INDEX idx_monitoring_geometry ON monitoring_points USING GIST(geometry);
```

### Coordinate Reference Systems (CRS)
- **SRID 4326 (WGS84)**: Standard lat/lon for web maps
- **SRID 3857 (Web Mercator)**: Used by web mapping libraries
- PostGIS handles transformation: `ST_Transform(geometry, 3857)`

---

## 2. Data Sources & Import

### Option A: SWAT+ Model Output
If using SWAT+ watershed model:
```bash
# SWAT+ generates shapefiles:
# - riv1.shp (river network)
# - subs1.shp (subbasins)
# - hru1.shp (hydrologic response units)
```

### Option B: Public GIS Data
- **HydroSHEDS**: Global watershed boundaries
- **NHDPlus**: US river networks (USGS)
- **OpenStreetMap**: Rivers via Overpass API
- **GRASS GIS**: Delineate from DEM

### Import Methods

#### Method 1: Using ogr2ogr (GDAL)
```bash
# Import shapefile to PostGIS
ogr2ogr -f "PostgreSQL" \
  PG:"host=localhost dbname=postgres user=postgres password=postgres" \
  -nln rivers \
  -lco GEOMETRY_NAME=geometry \
  -lco SPATIAL_INDEX=GIST \
  rivers.shp

ogr2ogr -f "PostgreSQL" \
  PG:"host=localhost dbname=postgres user=postgres password=postgres" \
  -nln basins \
  -lco GEOMETRY_NAME=geometry \
  -lco SPATIAL_INDEX=GIST \
  basins.shp
```

#### Method 2: Using PostGIS shp2pgsql
```bash
# Generate SQL from shapefile
shp2pgsql -I -s 4326 rivers.shp public.rivers > rivers.sql
shp2pgsql -I -s 4326 basins.shp public.basins > basins.sql

# Import to database
psql -h localhost -U postgres -d postgres -f rivers.sql
psql -h localhost -U postgres -d postgres -f basins.sql
```

#### Method 3: Programmatic (Node.js + TypeORM/Prisma)
```typescript
// Using typeorm with PostGIS
import { Point, LineString, Polygon } from 'geojson';

@Entity()
class River {
  @PrimaryGeneratedColumn()
  id: number;

  @Column()
  name: string;

  @Column({
    type: 'geometry',
    spatialFeatureType: 'LineString',
    srid: 4326
  })
  geometry: LineString;
}
```

---

## 3. Backend API (NestJS)

### RESTful Endpoints

```typescript
// rivers.controller.ts
@Controller('api/rivers')
export class RiversController {

  // Get all rivers (with spatial filtering)
  @Get()
  async getRivers(
    @Query('bbox') bbox?: string,      // minLon,minLat,maxLon,maxLat
    @Query('basin_id') basinId?: number
  ): Promise<FeatureCollection> {
    // Return GeoJSON
  }

  // Get single river
  @Get(':id')
  async getRiver(@Param('id') id: number): Promise<Feature> {}

  // Get rivers within basin
  @Get('basin/:basinId')
  async getRiversInBasin(@Param('basinId') basinId: number) {}

  // Get rivers within bounding box
  @Get('bbox/:bbox')
  async getRiversInBbox(@Param('bbox') bbox: string) {}
}

@Controller('api/basins')
export class BasinsController {

  @Get()
  async getBasins(@Query('bbox') bbox?: string): Promise<FeatureCollection> {}

  @Get(':id')
  async getBasin(@Param('id') id: number): Promise<Feature> {}

  // Get basin containing a point
  @Post('find-by-point')
  async findBasinByPoint(@Body() point: { lon: number, lat: number }) {}
}
```

### Spatial Queries (TypeORM Repository)

```typescript
// rivers.service.ts
export class RiversService {

  async getRiversInBbox(bbox: BoundingBox): Promise<River[]> {
    return this.riverRepository
      .createQueryBuilder('river')
      .where(`ST_Intersects(
        river.geometry,
        ST_MakeEnvelope(:minLon, :minLat, :maxLon, :maxLat, 4326)
      )`)
      .setParameters(bbox)
      .getMany();
  }

  async getRiversInBasin(basinId: number): Promise<River[]> {
    return this.riverRepository
      .createQueryBuilder('river')
      .innerJoin('basins', 'basin', 'river.basin_id = basin.id')
      .where('basin.id = :basinId', { basinId })
      .getMany();
  }

  // Calculate river length
  async calculateLength(riverId: number): Promise<number> {
    const result = await this.riverRepository.query(`
      SELECT ST_Length(geometry::geography) / 1000 as length_km
      FROM rivers WHERE id = $1
    `, [riverId]);
    return result[0].length_km;
  }
}
```

### GeoJSON Response Format

```typescript
// Return format (RFC 7946 - GeoJSON)
interface RiverFeature {
  type: 'Feature';
  id: number;
  geometry: {
    type: 'LineString';
    coordinates: [number, number][];  // [lon, lat]
  };
  properties: {
    name: string;
    river_order: number;
    length_km: number;
    basin_id: number;
  };
}

interface FeatureCollection {
  type: 'FeatureCollection';
  features: RiverFeature[];
}
```

---

## 4. Frontend Mapping (Next.js)

### Library Options

| Library | Pros | Cons | Use Case |
|---------|------|------|----------|
| **Leaflet** | Free, simple, lightweight | Basic styling | Simple maps, quick prototypes |
| **Mapbox GL JS** | Beautiful, performant, vector tiles | Requires API key | Production, custom styling |
| **OpenLayers** | Feature-rich, no API key | Steeper learning curve | Complex GIS features |
| **Google Maps** | Familiar UX | Expensive, limited customization | Consumer apps |
| **deck.gl** | 3D visualization, large datasets | Complex setup | Advanced visualization |

**Recommendation**: Start with **Leaflet** (simple) or **Mapbox GL JS** (production-ready)

### Implementation: Leaflet

```bash
npm install leaflet react-leaflet
npm install -D @types/leaflet
```

```tsx
// components/WatershedMap.tsx
'use client';
import { MapContainer, TileLayer, GeoJSON, Popup } from 'react-leaflet';
import { useEffect, useState } from 'react';
import type { FeatureCollection } from 'geojson';
import 'leaflet/dist/leaflet.css';

export default function WatershedMap() {
  const [rivers, setRivers] = useState<FeatureCollection | null>(null);
  const [basins, setBasins] = useState<FeatureCollection | null>(null);

  useEffect(() => {
    // Fetch data from API
    fetch('/api/rivers')
      .then(res => res.json())
      .then(setRivers);

    fetch('/api/basins')
      .then(res => res.json())
      .then(setBasins);
  }, []);

  return (
    <MapContainer
      center={[31.0, -97.0]}  // Example: Central Texas
      zoom={8}
      style={{ height: '100vh', width: '100%' }}
    >
      {/* Base map */}
      <TileLayer
        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        attribution='&copy; OpenStreetMap contributors'
      />

      {/* Basins layer */}
      {basins && (
        <GeoJSON
          data={basins}
          style={{
            fillColor: '#3388ff',
            fillOpacity: 0.2,
            color: '#3388ff',
            weight: 2
          }}
          onEachFeature={(feature, layer) => {
            layer.bindPopup(`
              <strong>${feature.properties.name}</strong><br/>
              Area: ${feature.properties.area_km2} km²
            `);
          }}
        />
      )}

      {/* Rivers layer */}
      {rivers && (
        <GeoJSON
          data={rivers}
          style={{
            color: '#0066cc',
            weight: 2,
            opacity: 0.8
          }}
          onEachFeature={(feature, layer) => {
            layer.bindPopup(`
              <strong>${feature.properties.name}</strong><br/>
              Length: ${feature.properties.length_km} km<br/>
              Order: ${feature.properties.river_order}
            `);
          }}
        />
      )}
    </MapContainer>
  );
}
```

### Implementation: Mapbox GL JS

```bash
npm install mapbox-gl react-map-gl
```

```tsx
// components/MapboxMap.tsx
'use client';
import Map, { Source, Layer } from 'react-map-gl';
import type { LayerProps } from 'react-map-gl';
import 'mapbox-gl/dist/mapbox-gl.css';

const basinLayer: LayerProps = {
  id: 'basins',
  type: 'fill',
  paint: {
    'fill-color': '#3388ff',
    'fill-opacity': 0.3
  }
};

const riverLayer: LayerProps = {
  id: 'rivers',
  type: 'line',
  paint: {
    'line-color': '#0066cc',
    'line-width': 2
  }
};

export default function MapboxMap() {
  return (
    <Map
      initialViewState={{
        longitude: -97.0,
        latitude: 31.0,
        zoom: 8
      }}
      style={{ width: '100%', height: '100vh' }}
      mapStyle="mapbox://styles/mapbox/streets-v12"
      mapboxAccessToken={process.env.NEXT_PUBLIC_MAPBOX_TOKEN}
    >
      <Source id="basins-source" type="geojson" data="/api/basins">
        <Layer {...basinLayer} />
      </Source>

      <Source id="rivers-source" type="geojson" data="/api/rivers">
        <Layer {...riverLayer} />
      </Source>
    </Map>
  );
}
```

---

## 5. Performance Optimization

### Backend Optimizations

```sql
-- 1. Simplify geometries for large datasets
SELECT
  id,
  name,
  ST_Simplify(geometry, 0.001) as geometry  -- Reduce vertices
FROM rivers;

-- 2. Use bounding box pre-filter
SELECT * FROM rivers
WHERE geometry && ST_MakeEnvelope(-98, 30, -96, 32, 4326)  -- && is bbox operator
  AND ST_Intersects(geometry, ST_MakeEnvelope(-98, 30, -96, 32, 4326));

-- 3. Cluster points (for monitoring stations)
SELECT
  ST_NumGeometries(geom_cluster) as count,
  ST_Centroid(geom_cluster) as centroid
FROM (
  SELECT unnest(ST_ClusterWithin(geometry, 0.01)) as geom_cluster
  FROM monitoring_points
) clusters;
```

### Frontend Optimizations

1. **Viewport-based loading**: Only fetch visible features
```typescript
// Load rivers in current map bounds
const bounds = map.getBounds();
fetch(`/api/rivers?bbox=${bounds.toBBoxString()}`);
```

2. **Vector tiles**: Pre-render tiles for large datasets
   - Use Mapbox Vector Tiles (MVT)
   - Generate with `tippecanoe` or `postgis-vt-util`

3. **Level of detail**: Show simplified geometries at low zoom
```typescript
const zoomLevel = map.getZoom();
const tolerance = zoomLevel < 8 ? 0.01 : 0.001;
fetch(`/api/rivers?simplify=${tolerance}`);
```

4. **Client-side caching**
```typescript
// React Query
const { data: rivers } = useQuery({
  queryKey: ['rivers', bbox],
  queryFn: () => fetchRivers(bbox),
  staleTime: 5 * 60 * 1000  // Cache 5 minutes
});
```

---

## 6. Advanced Features

### Interactive Drawing (Add new rivers/basins)

```tsx
// Using Leaflet Draw
import { FeatureGroup } from 'react-leaflet';
import { EditControl } from 'react-leaflet-draw';

<FeatureGroup>
  <EditControl
    position="topright"
    onCreated={(e) => {
      const { layer } = e;
      const geoJSON = layer.toGeoJSON();
      // POST to /api/rivers with geoJSON
    }}
    draw={{
      polyline: { shapeOptions: { color: '#0066cc' } },
      polygon: { shapeOptions: { color: '#3388ff' } },
      rectangle: false,
      circle: false,
      circlemarker: false,
      marker: true
    }}
  />
</FeatureGroup>
```

### Spatial Queries UI

```typescript
// Find basin containing clicked point
map.on('click', async (e) => {
  const { lat, lng } = e.latlng;
  const response = await fetch('/api/basins/find-by-point', {
    method: 'POST',
    body: JSON.stringify({ lat, lon: lng })
  });
  const basin = await response.json();
  // Highlight basin on map
});
```

### Export Functionality

```typescript
// Export as GeoJSON
const exportGeoJSON = () => {
  const dataStr = JSON.stringify(rivers, null, 2);
  const blob = new Blob([dataStr], { type: 'application/json' });
  downloadBlob(blob, 'rivers.geojson');
};

// Export as Shapefile (backend)
@Get('export/shapefile')
async exportShapefile(@Res() res: Response) {
  // Use ogr2ogr or gdal bindings
  const shpBuffer = await this.geoService.exportToShapefile();
  res.set({
    'Content-Type': 'application/zip',
    'Content-Disposition': 'attachment; filename=rivers.zip'
  });
  res.send(shpBuffer);
}
```

---

## 7. Technology Stack Summary

```
┌─────────────────────────────────────────────┐
│           Frontend (Next.js)                │
│  - Leaflet/Mapbox GL JS                     │
│  - React hooks for data fetching            │
│  - GeoJSON rendering                        │
└──────────────┬──────────────────────────────┘
               │ HTTP/REST (GeoJSON)
┌──────────────▼──────────────────────────────┐
│           Backend (NestJS)                  │
│  - RESTful API endpoints                    │
│  - TypeORM with PostGIS types               │
│  - Spatial query logic                      │
└──────────────┬──────────────────────────────┘
               │ SQL/PostGIS queries
┌──────────────▼──────────────────────────────┐
│         Database (PostgreSQL + PostGIS)     │
│  - Geometry columns (LINESTRING, POLYGON)   │
│  - Spatial indexes (GIST)                   │
│  - Spatial functions (ST_*)                 │
└─────────────────────────────────────────────┘
```

---

## 8. Implementation Checklist

### Phase 1: Database Setup
- [ ] Enable PostGIS extension
- [ ] Create rivers and basins tables
- [ ] Add spatial indexes
- [ ] Import sample data (shapefile or manual)

### Phase 2: Backend API
- [ ] Create TypeORM entities with geometry types
- [ ] Implement rivers CRUD endpoints
- [ ] Implement basins CRUD endpoints
- [ ] Add GeoJSON serialization
- [ ] Add bounding box filtering
- [ ] Add spatial query endpoints

### Phase 3: Frontend Map
- [ ] Install mapping library (Leaflet/Mapbox)
- [ ] Create base map component
- [ ] Fetch and render rivers (LineString)
- [ ] Fetch and render basins (Polygon)
- [ ] Add popups/tooltips
- [ ] Add layer controls (toggle layers)

### Phase 4: Enhancements
- [ ] Viewport-based loading
- [ ] Search/filter UI
- [ ] Interactive drawing tools
- [ ] Export functionality
- [ ] Measurement tools (distance, area)
- [ ] Legend and styling controls

---

## 9. Common Issues & Solutions

**Issue**: Geometries not displaying
- Check SRID matches (4326 for web maps)
- Verify coordinate order: GeoJSON uses [lon, lat], not [lat, lon]
- Check bounding box query

**Issue**: Poor performance with large datasets
- Add spatial indexes
- Implement viewport filtering
- Simplify geometries at low zoom
- Consider vector tiles

**Issue**: Coordinate system confusion
- Database: Store as SRID 4326 (WGS84)
- API: Return GeoJSON (always 4326)
- Map: Leaflet uses 3857 internally but accepts 4326

**Issue**: Memory issues
- Don't load all features at once
- Use pagination or tiling
- Stream large responses

---

## 10. Example Data Flow

```
User views map at zoom level 8
        ↓
Frontend calculates viewport bounds: [-98, 30, -96, 32]
        ↓
GET /api/rivers?bbox=-98,30,-96,32
        ↓
Backend queries PostGIS:
  SELECT id, name, ST_AsGeoJSON(geometry)
  FROM rivers
  WHERE geometry && ST_MakeEnvelope(-98, 30, -96, 32, 4326)
        ↓
Returns GeoJSON FeatureCollection
        ↓
Frontend renders LineStrings on map
        ↓
User clicks river → Shows popup with properties
```

---

## Resources

- PostGIS docs: https://postgis.net/documentation/
- GeoJSON spec: https://datatracker.ietf.org/doc/html/rfc7946
- Leaflet: https://leafletjs.com/
- Mapbox GL JS: https://docs.mapbox.com/mapbox-gl-js/
- SWAT+ model: https://swat.tamu.edu/software/plus/
