import { Injectable, OnModuleInit } from '@nestjs/common';
import { Pool } from 'pg';
import type { FeatureCollection, Feature, LineString, Polygon } from 'geojson';

@Injectable()
export class GeoService implements OnModuleInit {
  private pool: Pool;

  async onModuleInit() {
    // Initialize PostgreSQL connection pool
    this.pool = new Pool({
      host: process.env.DATABASE_HOST || 'postgres',
      port: parseInt(process.env.DATABASE_PORT || '5432'),
      user: process.env.DATABASE_USER || 'postgres',
      password: process.env.DATABASE_PASSWORD || 'postgres',
      database: process.env.DATABASE_NAME || 'postgres',
      max: 20,
      idleTimeoutMillis: 30000,
      connectionTimeoutMillis: 2000,
    });

    // Test connection
    try {
      const client = await this.pool.connect();
      const result = await client.query('SELECT PostGIS_Version()');
      console.log('PostGIS connected:', result.rows[0]);
      client.release();
    } catch (err) {
      console.error('Error connecting to PostGIS:', err);
    }
  }

  async getRivers(bbox?: string): Promise<FeatureCollection> {
    let query = `
      SELECT
        id,
        name,
        river_order,
        length_km,
        ST_AsGeoJSON(geometry)::json as geometry
      FROM rivers
    `;

    const params: any[] = [];

    // Add bounding box filter if provided
    if (bbox) {
      const [minLon, minLat, maxLon, maxLat] = bbox.split(',').map(Number);
      query += ` WHERE geometry && ST_MakeEnvelope($1, $2, $3, $4, 4326)`;
      params.push(minLon, minLat, maxLon, maxLat);
    }

    query += ` ORDER BY river_order DESC, length_km DESC`;

    const result = await this.pool.query(query, params);

    return {
      type: 'FeatureCollection',
      features: result.rows.map((row) => ({
        type: 'Feature',
        id: row.id,
        geometry: row.geometry,
        properties: {
          name: row.name,
          river_order: row.river_order,
          length_km: row.length_km,
        },
      })),
    };
  }

  async getRiverById(id: number): Promise<Feature<LineString> | null> {
    const result = await this.pool.query(
      `
      SELECT
        id,
        name,
        river_order,
        length_km,
        metadata,
        ST_AsGeoJSON(geometry)::json as geometry
      FROM rivers
      WHERE id = $1
    `,
      [id],
    );

    if (result.rows.length === 0) {
      return null;
    }

    const row = result.rows[0];
    return {
      type: 'Feature',
      id: row.id,
      geometry: row.geometry,
      properties: {
        name: row.name,
        river_order: row.river_order,
        length_km: row.length_km,
        metadata: row.metadata,
      },
    };
  }

  async getBasins(bbox?: string): Promise<FeatureCollection> {
    let query = `
      SELECT
        id,
        name,
        area_km2,
        ST_AsGeoJSON(geometry)::json as geometry
      FROM basins
    `;

    const params: any[] = [];

    // Add bounding box filter if provided
    if (bbox) {
      const [minLon, minLat, maxLon, maxLat] = bbox.split(',').map(Number);
      query += ` WHERE geometry && ST_MakeEnvelope($1, $2, $3, $4, 4326)`;
      params.push(minLon, minLat, maxLon, maxLat);
    }

    query += ` ORDER BY area_km2 DESC`;

    const result = await this.pool.query(query, params);

    return {
      type: 'FeatureCollection',
      features: result.rows.map((row) => ({
        type: 'Feature',
        id: row.id,
        geometry: row.geometry,
        properties: {
          name: row.name,
          area_km2: row.area_km2,
        },
      })),
    };
  }

  async getBasinById(id: number): Promise<Feature<Polygon> | null> {
    const result = await this.pool.query(
      `
      SELECT
        id,
        name,
        area_km2,
        metadata,
        ST_AsGeoJSON(geometry)::json as geometry
      FROM basins
      WHERE id = $1
    `,
      [id],
    );

    if (result.rows.length === 0) {
      return null;
    }

    const row = result.rows[0];
    return {
      type: 'Feature',
      id: row.id,
      geometry: row.geometry,
      properties: {
        name: row.name,
        area_km2: row.area_km2,
        metadata: row.metadata,
      },
    };
  }

  async findBasinByPoint(lon: number, lat: number): Promise<Feature<Polygon> | null> {
    const result = await this.pool.query(
      `
      SELECT
        id,
        name,
        area_km2,
        ST_AsGeoJSON(geometry)::json as geometry
      FROM basins
      WHERE ST_Contains(geometry, ST_SetSRID(ST_Point($1, $2), 4326))
      LIMIT 1
    `,
      [lon, lat],
    );

    if (result.rows.length === 0) {
      return null;
    }

    const row = result.rows[0];
    return {
      type: 'Feature',
      id: row.id,
      geometry: row.geometry,
      properties: {
        name: row.name,
        area_km2: row.area_km2,
      },
    };
  }

  async createRiver(name: string, geojson: LineString): Promise<Feature<LineString>> {
    const result = await this.pool.query(
      `
      INSERT INTO rivers (name, geometry)
      VALUES ($1, ST_GeomFromGeoJSON($2))
      RETURNING id, name, ST_AsGeoJSON(geometry)::json as geometry
    `,
      [name, JSON.stringify(geojson)],
    );

    const row = result.rows[0];
    return {
      type: 'Feature',
      id: row.id,
      geometry: row.geometry,
      properties: {
        name: row.name,
      },
    };
  }

  async createBasin(name: string, geojson: Polygon): Promise<Feature<Polygon>> {
    const result = await this.pool.query(
      `
      INSERT INTO basins (name, geometry)
      VALUES ($1, ST_GeomFromGeoJSON($2))
      RETURNING id, name, ST_AsGeoJSON(geometry)::json as geometry
    `,
      [name, JSON.stringify(geojson)],
    );

    const row = result.rows[0];
    return {
      type: 'Feature',
      id: row.id,
      geometry: row.geometry,
      properties: {
        name: row.name,
      },
    };
  }
}
