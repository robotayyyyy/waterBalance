import { Pool } from 'pg';

// Environment variables are loaded by the system (no dotenv needed)

interface OSMNode {
  type: 'node';
  id: number;
  lat: number;
  lon: number;
}

interface OSMWay {
  type: 'way';
  id: number;
  nodes?: number[];
  geometry?: Array<{ lat: number; lon: number }>;
  tags?: {
    name?: string;
    'name:en'?: string;
    'name:th'?: string;
    waterway?: string;
  };
}

interface OverpassResponse {
  elements: Array<OSMNode | OSMWay>;
}

async function fetchThailandRivers(): Promise<OverpassResponse> {
  console.log('Fetching Thailand rivers from OpenStreetMap...');

  // Query for major rivers in Thailand
  // Using bounding box for Thailand: approximately 5.6°N to 20.5°N, 97.3°E to 105.6°E
  const query = `
    [out:json][timeout:360];
    (
      way["waterway"="river"]["name"](5.6,97.3,20.5,105.6);
    );
    out geom;
  `;

  const response = await fetch('https://overpass-api.de/api/interpreter', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: `data=${encodeURIComponent(query)}`,
  });

  if (!response.ok) {
    throw new Error(`Overpass API error: ${response.statusText}`);
  }

  return response.json();
}

async function fetchThailandBasins(): Promise<OverpassResponse> {
  console.log('Fetching Thailand water basins from OpenStreetMap...');

  // Query for water areas/basins in Thailand
  const query = `
    [out:json][timeout:360];
    (
      way["natural"="water"]["water"="reservoir"]["name"](5.6,97.3,20.5,105.6);
      relation["natural"="water"]["name"](5.6,97.3,20.5,105.6);
    );
    out geom;
  `;

  const response = await fetch('https://overpass-api.de/api/interpreter', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: `data=${encodeURIComponent(query)}`,
  });

  if (!response.ok) {
    throw new Error(`Overpass API error: ${response.statusText}`);
  }

  return response.json();
}

function convertOSMWayToLineString(way: OSMWay): {
  name: string;
  coordinates: number[][];
} | null {
  if (!way.geometry || way.geometry.length < 2) {
    return null;
  }

  const name = way.tags?.name || way.tags?.['name:en'] || way.tags?.['name:th'] || `River ${way.id}`;
  const coordinates = way.geometry.map(node => [node.lon, node.lat]);

  return { name, coordinates };
}

function convertOSMWayToPolygon(way: OSMWay): {
  name: string;
  coordinates: number[][][];
} | null {
  if (!way.geometry || way.geometry.length < 4) {
    return null;
  }

  const name = way.tags?.name || way.tags?.['name:en'] || way.tags?.['name:th'] || `Basin ${way.id}`;
  const coordinates = way.geometry.map(node => [node.lon, node.lat]);

  // Close the polygon if not already closed
  const first = coordinates[0];
  const last = coordinates[coordinates.length - 1];
  if (first[0] !== last[0] || first[1] !== last[1]) {
    coordinates.push([...first]);
  }

  return { name, coordinates: [coordinates] };
}

async function importRivers(pool: Pool, data: OverpassResponse) {
  console.log(`Processing ${data.elements.length} river features...`);

  let imported = 0;
  let skipped = 0;

  for (const element of data.elements) {
    if (element.type !== 'way') continue;

    const linestring = convertOSMWayToLineString(element as OSMWay);
    if (!linestring) {
      skipped++;
      continue;
    }

    try {
      const geojson = {
        type: 'LineString',
        coordinates: linestring.coordinates,
      };

      await pool.query(
        `
        INSERT INTO rivers (name, geometry, metadata)
        VALUES ($1, ST_GeomFromGeoJSON($2), $3)
        ON CONFLICT DO NOTHING
        `,
        [
          linestring.name,
          JSON.stringify(geojson),
          JSON.stringify({ osm_id: (element as OSMWay).id }),
        ],
      );

      imported++;
      if (imported % 10 === 0) {
        console.log(`Imported ${imported} rivers...`);
      }
    } catch (err) {
      console.error(`Error importing river ${linestring.name}:`, err.message);
      skipped++;
    }
  }

  console.log(`✓ Imported ${imported} rivers (${skipped} skipped)`);
}

async function importBasins(pool: Pool, data: OverpassResponse) {
  console.log(`Processing ${data.elements.length} basin features...`);

  let imported = 0;
  let skipped = 0;

  for (const element of data.elements) {
    if (element.type !== 'way') continue;

    const polygon = convertOSMWayToPolygon(element as OSMWay);
    if (!polygon) {
      skipped++;
      continue;
    }

    try {
      const geojson = {
        type: 'Polygon',
        coordinates: polygon.coordinates,
      };

      await pool.query(
        `
        INSERT INTO basins (name, geometry, metadata)
        VALUES ($1, ST_GeomFromGeoJSON($2), $3)
        ON CONFLICT DO NOTHING
        `,
        [
          polygon.name,
          JSON.stringify(geojson),
          JSON.stringify({ osm_id: (element as OSMWay).id }),
        ],
      );

      imported++;
      if (imported % 5 === 0) {
        console.log(`Imported ${imported} basins...`);
      }
    } catch (err) {
      console.error(`Error importing basin ${polygon.name}:`, err.message);
      skipped++;
    }
  }

  console.log(`✓ Imported ${imported} basins (${skipped} skipped)`);
}

async function updateGeometryStats(pool: Pool) {
  console.log('Updating geometry statistics...');

  // Update river lengths
  await pool.query(`
    UPDATE rivers
    SET length_km = ROUND((ST_Length(geometry::geography) / 1000)::numeric, 2)
    WHERE length_km IS NULL
  `);

  // Update basin areas
  await pool.query(`
    UPDATE basins
    SET area_km2 = ROUND((ST_Area(geometry::geography) / 1000000)::numeric, 2)
    WHERE area_km2 IS NULL
  `);

  console.log('✓ Updated geometry statistics');
}

async function main() {
  console.log('=== Thailand Water Data Import ===\n');

  // Initialize database connection
  const pool = new Pool({
    host: process.env.DATABASE_HOST || 'localhost',
    port: parseInt(process.env.DATABASE_PORT || '5432'),
    user: process.env.DATABASE_USER || 'postgres',
    password: process.env.DATABASE_PASSWORD || 'postgres',
    database: process.env.DATABASE_NAME || 'postgres',
  });

  try {
    // Test connection
    const result = await pool.query('SELECT PostGIS_Version()');
    console.log('✓ Connected to PostGIS:', result.rows[0].postgis_version);
    console.log();

    // Fetch and import rivers
    const riverData = await fetchThailandRivers();
    await importRivers(pool, riverData);
    console.log();

    // Fetch and import basins
    const basinData = await fetchThailandBasins();
    await importBasins(pool, basinData);
    console.log();

    // Update calculated fields
    await updateGeometryStats(pool);
    console.log();

    // Show summary
    const riverCount = await pool.query('SELECT COUNT(*) FROM rivers');
    const basinCount = await pool.query('SELECT COUNT(*) FROM basins');

    console.log('=== Import Complete ===');
    console.log(`Total rivers in database: ${riverCount.rows[0].count}`);
    console.log(`Total basins in database: ${basinCount.rows[0].count}`);

  } catch (error) {
    console.error('Error during import:', error);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

main();
