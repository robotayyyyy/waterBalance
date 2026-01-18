import { Pool } from 'pg';
import * as fs from 'fs';
import * as path from 'path';
import * as shapefile from 'shapefile';
import AdmZip from 'adm-zip';

/**
 * HydroSHEDS Data Import Script
 *
 * Downloads and imports river networks and basin boundaries from HydroSHEDS.
 * Source: https://www.hydrosheds.org/
 *
 * Data includes:
 * - HydroRIVERS: River network derived from HydroSHEDS
 * - HydroBASINS: Watershed boundaries at multiple levels (1-12)
 *
 * Usage:
 *   npx ts-node src/scripts/import-hydrosheds.ts [options]
 *
 * Options:
 *   --region=as    Region code: as (Asia), af (Africa), au (Australia),
 *                  eu (Europe), na (North America), sa (South America)
 *   --rivers       Import rivers only
 *   --basins       Import basins only
 *   --level=8      Basin level (1-12, default: 8)
 *   --bbox=minLon,minLat,maxLon,maxLat  Filter by bounding box (e.g., Thailand: 97.3,5.6,105.6,20.5)
 */

// Configuration
const CONFIG = {
  dataDir: '/tmp/hydrosheds',
  regions: {
    as: 'Asia',
    af: 'Africa',
    au: 'Australia',
    eu: 'Europe',
    na: 'North America',
    sa: 'South America',
  },
  urls: {
    rivers: (region: string) =>
      `https://data.hydrosheds.org/file/HydroRIVERS/HydroRIVERS_v10_${region}_shp.zip`,
    basins: (region: string) =>
      `https://data.hydrosheds.org/file/HydroBASINS/standard/hybas_${region}_lev01-12_v1c.zip`,
  },
  // Thailand bounding box
  defaultBbox: {
    minLon: 97.3,
    minLat: 5.6,
    maxLon: 105.6,
    maxLat: 20.5,
  },
};

interface BoundingBox {
  minLon: number;
  minLat: number;
  maxLon: number;
  maxLat: number;
}

interface ImportOptions {
  region: string;
  importRivers: boolean;
  importBasins: boolean;
  basinLevel: number;
  bbox?: BoundingBox;
}

function parseArgs(): ImportOptions {
  const args = process.argv.slice(2);
  const options: ImportOptions = {
    region: 'as',
    importRivers: true,
    importBasins: true,
    basinLevel: 8,
    bbox: CONFIG.defaultBbox,
  };

  for (const arg of args) {
    if (arg.startsWith('--region=')) {
      options.region = arg.split('=')[1];
    } else if (arg === '--rivers') {
      options.importRivers = true;
      options.importBasins = false;
    } else if (arg === '--basins') {
      options.importRivers = false;
      options.importBasins = true;
    } else if (arg.startsWith('--level=')) {
      options.basinLevel = parseInt(arg.split('=')[1]);
    } else if (arg.startsWith('--bbox=')) {
      const [minLon, minLat, maxLon, maxLat] = arg.split('=')[1].split(',').map(Number);
      options.bbox = { minLon, minLat, maxLon, maxLat };
    } else if (arg === '--no-bbox') {
      options.bbox = undefined;
    }
  }

  return options;
}

function ensureDir(dir: string) {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
}

async function downloadFile(url: string, destPath: string): Promise<void> {
  if (fs.existsSync(destPath)) {
    console.log(`  File exists, skipping download: ${path.basename(destPath)}`);
    return;
  }

  console.log(`  Downloading: ${url}`);
  console.log(`  This may take a while...`);

  try {
    const response = await fetch(url);
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }

    const buffer = await response.arrayBuffer();
    fs.writeFileSync(destPath, Buffer.from(buffer));
    console.log(`  ✓ Downloaded: ${path.basename(destPath)} (${(buffer.byteLength / 1024 / 1024).toFixed(1)} MB)`);
  } catch (error: any) {
    throw new Error(`Failed to download: ${url} - ${error.message}`);
  }
}

function extractZip(zipPath: string, destDir: string): void {
  console.log(`  Extracting: ${path.basename(zipPath)}`);

  ensureDir(destDir);

  try {
    const zip = new AdmZip(zipPath);
    zip.extractAllTo(destDir, true);
    console.log(`  ✓ Extracted to: ${destDir}`);
  } catch (error: any) {
    throw new Error(`Failed to extract: ${zipPath} - ${error.message}`);
  }
}

function findShapefile(dir: string, pattern: string): string | null {
  const files = fs.readdirSync(dir, { recursive: true }) as string[];

  for (const file of files) {
    if (file.endsWith('.shp') && file.toLowerCase().includes(pattern.toLowerCase())) {
      return path.join(dir, file);
    }
  }

  return null;
}

function isInBbox(coords: number[], bbox: BoundingBox): boolean {
  const [lon, lat] = coords;
  return lon >= bbox.minLon && lon <= bbox.maxLon && lat >= bbox.minLat && lat <= bbox.maxLat;
}

function featureIntersectsBbox(feature: any, bbox: BoundingBox): boolean {
  if (!feature.geometry || !feature.geometry.coordinates) return false;

  const checkCoords = (coords: any): boolean => {
    if (typeof coords[0] === 'number') {
      return isInBbox(coords, bbox);
    }
    return coords.some((c: any) => checkCoords(c));
  };

  return checkCoords(feature.geometry.coordinates);
}

async function importRivers(pool: Pool, shpPath: string, bbox?: BoundingBox): Promise<number> {
  console.log('\n=== Importing Rivers ===');
  console.log(`  Source: ${shpPath}`);

  if (bbox) {
    console.log(`  Filtering to bbox: ${bbox.minLon},${bbox.minLat},${bbox.maxLon},${bbox.maxLat}`);
  }

  console.log('  Reading shapefile...');

  let imported = 0;
  let skipped = 0;
  let filtered = 0;
  let total = 0;

  try {
    const source = await shapefile.open(shpPath);

    while (true) {
      const result = await source.read();
      if (result.done) break;

      const feature = result.value;
      total++;

      // Filter by bounding box
      if (bbox && !featureIntersectsBbox(feature, bbox)) {
        filtered++;
        continue;
      }

      try {
        const props = feature.properties || {};
        const name = props.RIVER_NAME || props.NAME || `HydroRiver_${props.HYRIV_ID || imported}`;
        const riverOrder = props.ORD_STRA || props.STREAM_ORD || null;
        const lengthKm = props.LENGTH_KM || null;

        await pool.query(
          `INSERT INTO rivers (name, geometry, river_order, length_km, metadata)
           VALUES ($1, ST_GeomFromGeoJSON($2), $3, $4, $5)
           ON CONFLICT DO NOTHING`,
          [
            name,
            JSON.stringify(feature.geometry),
            riverOrder,
            lengthKm,
            JSON.stringify({ source: 'HydroSHEDS', hyriv_id: props.HYRIV_ID, ...props }),
          ]
        );

        imported++;
        if (imported % 100 === 0) {
          console.log(`  Imported ${imported} rivers...`);
        }
      } catch (err: any) {
        skipped++;
      }
    }
  } catch (error: any) {
    console.log(`  Error reading shapefile: ${error.message}`);
    return 0;
  }

  console.log(`  ✓ Imported ${imported} rivers (${skipped} skipped, ${filtered} outside bbox, ${total} total)`);
  return imported;
}

async function importBasins(pool: Pool, shpPath: string, level: number, bbox?: BoundingBox): Promise<number> {
  console.log('\n=== Importing Basins ===');
  console.log(`  Source: ${shpPath}`);
  console.log(`  Level: ${level}`);

  if (bbox) {
    console.log(`  Filtering to bbox: ${bbox.minLon},${bbox.minLat},${bbox.maxLon},${bbox.maxLat}`);
  }

  console.log('  Reading shapefile...');

  let imported = 0;
  let skipped = 0;
  let filtered = 0;
  let total = 0;

  try {
    const source = await shapefile.open(shpPath);

    while (true) {
      const result = await source.read();
      if (result.done) break;

      const feature = result.value;
      total++;

      // Filter by bounding box
      if (bbox && !featureIntersectsBbox(feature, bbox)) {
        filtered++;
        continue;
      }

      try {
        const props = feature.properties || {};
        const name = props.NAME || `Basin_${props.HYBAS_ID || imported}`;
        const areaKm2 = props.SUB_AREA || props.AREA_SQKM || null;

        await pool.query(
          `INSERT INTO basins (name, geometry, area_km2, metadata)
           VALUES ($1, ST_GeomFromGeoJSON($2), $3, $4)
           ON CONFLICT DO NOTHING`,
          [
            name,
            JSON.stringify(feature.geometry),
            areaKm2,
            JSON.stringify({ source: 'HydroSHEDS', hybas_id: props.HYBAS_ID, level, ...props }),
          ]
        );

        imported++;
        if (imported % 50 === 0) {
          console.log(`  Imported ${imported} basins...`);
        }
      } catch (err: any) {
        skipped++;
      }
    }
  } catch (error: any) {
    console.log(`  Error reading shapefile: ${error.message}`);
    return 0;
  }

  console.log(`  ✓ Imported ${imported} basins (${skipped} skipped, ${filtered} outside bbox, ${total} total)`);
  return imported;
}

async function updateStats(pool: Pool) {
  console.log('\n=== Updating Statistics ===');

  // Update river lengths where missing
  await pool.query(`
    UPDATE rivers
    SET length_km = ROUND((ST_Length(geometry::geography) / 1000)::numeric, 2)
    WHERE length_km IS NULL
  `);

  // Update basin areas where missing
  await pool.query(`
    UPDATE basins
    SET area_km2 = ROUND((ST_Area(geometry::geography) / 1000000)::numeric, 2)
    WHERE area_km2 IS NULL
  `);

  console.log('  ✓ Statistics updated');
}

async function main() {
  const options = parseArgs();

  console.log('╔════════════════════════════════════════════════════════════╗');
  console.log('║           HydroSHEDS Data Import                           ║');
  console.log('╚════════════════════════════════════════════════════════════╝');
  console.log();
  console.log(`Region: ${CONFIG.regions[options.region] || options.region}`);
  console.log(`Import rivers: ${options.importRivers}`);
  console.log(`Import basins: ${options.importBasins}`);
  if (options.importBasins) {
    console.log(`Basin level: ${options.basinLevel}`);
  }
  if (options.bbox) {
    console.log(`Bounding box: ${options.bbox.minLon},${options.bbox.minLat},${options.bbox.maxLon},${options.bbox.maxLat}`);
  }
  console.log();

  // Ensure data directory exists
  ensureDir(CONFIG.dataDir);

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

    let totalRivers = 0;
    let totalBasins = 0;

    // Import rivers
    if (options.importRivers) {
      const riverZip = path.join(CONFIG.dataDir, `HydroRIVERS_${options.region}.zip`);
      const riverDir = path.join(CONFIG.dataDir, `rivers_${options.region}`);

      await downloadFile(CONFIG.urls.rivers(options.region), riverZip);
      extractZip(riverZip, riverDir);

      const riverShp = findShapefile(riverDir, 'HydroRIVERS');
      if (riverShp) {
        totalRivers = await importRivers(pool, riverShp, options.bbox);
      } else {
        console.log('  ⚠ River shapefile not found');
      }
    }

    // Import basins
    if (options.importBasins) {
      const basinZip = path.join(CONFIG.dataDir, `HydroBASINS_${options.region}.zip`);
      const basinDir = path.join(CONFIG.dataDir, `basins_${options.region}`);

      await downloadFile(CONFIG.urls.basins(options.region), basinZip);
      extractZip(basinZip, basinDir);

      // Find the shapefile for the requested level
      const levelStr = options.basinLevel.toString().padStart(2, '0');
      const basinShp = findShapefile(basinDir, `lev${levelStr}`);

      if (basinShp) {
        totalBasins = await importBasins(pool, basinShp, options.basinLevel, options.bbox);
      } else {
        console.log(`  ⚠ Basin shapefile for level ${options.basinLevel} not found`);
        console.log('  Available levels: 01-12');
      }
    }

    // Update statistics
    await updateStats(pool);

    // Summary
    console.log('\n╔════════════════════════════════════════════════════════════╗');
    console.log('║                    Import Complete                         ║');
    console.log('╚════════════════════════════════════════════════════════════╝');

    const riverCount = await pool.query('SELECT COUNT(*) FROM rivers');
    const basinCount = await pool.query('SELECT COUNT(*) FROM basins');

    console.log(`Rivers imported this run: ${totalRivers}`);
    console.log(`Basins imported this run: ${totalBasins}`);
    console.log(`Total rivers in database: ${riverCount.rows[0].count}`);
    console.log(`Total basins in database: ${basinCount.rows[0].count}`);

  } catch (error) {
    console.error('\nError during import:', error);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

main();
