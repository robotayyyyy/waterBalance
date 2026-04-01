import { Injectable, OnModuleInit, BadRequestException } from '@nestjs/common';
import { Pool } from 'pg';

type Level = 'province' | 'amphoe' | 'tambon';
type Model = '7days' | '6months';
type Mode = 'drought' | 'runoff' | 'waterbalance';

const MODE_FIELD: Record<Mode, string> = {
  drought: 'drought_index',
  runoff: 'runoff_index',
  waterbalance: 'water_balance',
};

const ID_FIELD: Record<Level, string> = {
  province: 'province_id',
  amphoe: 'amphoe_id',
  tambon: 'tambon_id',
};

const NAME_FIELD: Record<Level, string> = {
  province: 'province',
  amphoe: 'amphoe',
  tambon: 'tambon',
};

@Injectable()
export class ForecastService implements OnModuleInit {
  private pool: Pool;

  async onModuleInit() {
    this.pool = new Pool({
      host: process.env.DATABASE_HOST || 'localhost',
      port: parseInt(process.env.DATABASE_PORT || '5432'),
      user: process.env.DATABASE_USER || 'postgres',
      password: process.env.DATABASE_PASSWORD || 'postgres',
      database: process.env.DATABASE_NAME || 'postgres',
      max: 10,
      idleTimeoutMillis: 30000,
      connectionTimeoutMillis: 10000,
    });
  }

  private tableName(level: Level, model: Model): string {
    return `forecast_${level}_${model}`;
  }

  private validateModel(model: string): Model {
    if (model !== '7days' && model !== '6months') {
      throw new BadRequestException(`model must be "7days" or "6months"`);
    }
    return model;
  }

  private validateMode(mode: string): Mode {
    if (!['drought', 'runoff', 'waterbalance'].includes(mode)) {
      throw new BadRequestException(`mode must be "drought", "runoff", or "waterbalance"`);
    }
    return mode as Mode;
  }

  private validateLevel(level: string): Level {
    if (!['province', 'amphoe', 'tambon'].includes(level)) {
      throw new BadRequestException(`level must be "province", "amphoe", or "tambon"`);
    }
    return level as Level;
  }

  // GET /forecast/provinces — static list, derived from data in DB
  async getProvinces(): Promise<{ id: string; name: string }[]> {
    const result = await this.pool.query(`
      SELECT DISTINCT province_id AS id, province AS name
      FROM forecast_province_7days
      ORDER BY province_id
    `);
    return result.rows;
  }

  // GET /forecast/dates — available DateSim values in range for a model
  async getDates(model: string, start: string, end: string): Promise<string[]> {
    const m = this.validateModel(model);
    const table = this.tableName('province', m);
    const result = await this.pool.query(
      `SELECT DISTINCT date_sim::text
       FROM ${table}
       WHERE date_sim BETWEEN $1 AND $2
       ORDER BY date_sim`,
      [start, end],
    );
    return result.rows.map((r) => r.date_sim);
  }

  // GET /forecast/:level — color data (id + value)
  async getColorData(
    level: string,
    model: string,
    mode: string,
    date: string,
    provinceId?: string,
  ): Promise<{ id: string; value: number }[]> {
    const lv = this.validateLevel(level);
    const m = this.validateModel(model);
    const md = this.validateMode(mode);

    const table = this.tableName(lv, m);
    const idField = ID_FIELD[lv];
    const valueField = MODE_FIELD[md];

    const params: any[] = [date];
    let whereClause = 'WHERE date_sim = $1';

    if (provinceId && lv !== 'province') {
      params.push(provinceId);
      whereClause += ` AND province_id = $2`;
    }

    const result = await this.pool.query(
      `SELECT DISTINCT ON (${idField}) ${idField} AS id, ${valueField} AS value
       FROM ${table}
       ${whereClause}
       ORDER BY ${idField}`,
      params,
    );
    return result.rows;
  }

  // GET /forecast/:level/detail — all raw fields
  async getDetail(
    level: string,
    model: string,
    date: string,
    provinceId?: string,
  ): Promise<any[]> {
    const lv = this.validateLevel(level);
    const m = this.validateModel(model);

    const table = this.tableName(lv, m);
    const idField = ID_FIELD[lv];
    const nameField = NAME_FIELD[lv];

    const params: any[] = [date];
    let whereClause = 'WHERE date_sim = $1';

    if (provinceId && lv !== 'province') {
      params.push(provinceId);
      whereClause += ` AND province_id = $2`;
    }

    const result = await this.pool.query(
      `SELECT DISTINCT ON (${idField})
         ${idField}     AS id,
         ${nameField}   AS name,
         rainfall,
         watersupply,
         reservoir,
         water_demand,
         water_balance,
         drought_index,
         runoff_index
       FROM ${table}
       ${whereClause}
       ORDER BY ${idField}`,
      params,
    );
    return result.rows;
  }
}
