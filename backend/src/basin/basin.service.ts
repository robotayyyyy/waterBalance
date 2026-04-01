import { Injectable, OnModuleInit, BadRequestException } from '@nestjs/common';
import { Pool } from 'pg';

type BasinLevel = 'watershed' | 'subbasin-l1' | 'subbasin-l2';
type Model = '7days' | '6months';
type Mode = 'drought' | 'runoff' | 'waterbalance';

const MODE_FIELD: Record<Mode, string> = {
  drought: 'drought_index',
  runoff: 'runoff_index',
  waterbalance: 'water_balance',
};

// Each level's table suffix, ID column, and name column
const LEVEL_META: Record<BasinLevel, { suffix: string; idField: string; nameField: string | null }> = {
  'watershed':    { suffix: 'watershed',    idField: 'mb_code',   nameField: 'mb_name_t' },
  'subbasin-l1':  { suffix: 'subbasin_l1',  idField: 'sb_code',   nameField: 'sb_name_t' },
  'subbasin-l2':  { suffix: 'subbasin_l2',  idField: 'sbswat',    nameField: null },
};

@Injectable()
export class BasinService implements OnModuleInit {
  private pool: Pool;

  async onModuleInit() {
    this.pool = new Pool({
      host:     process.env.DATABASE_HOST     || 'localhost',
      port:     parseInt(process.env.DATABASE_PORT || '5432'),
      user:     process.env.DATABASE_USER     || 'postgres',
      password: process.env.DATABASE_PASSWORD || 'postgres',
      database: process.env.DATABASE_NAME     || 'postgres',
      max: 10,
      idleTimeoutMillis: 30000,
      connectionTimeoutMillis: 10000,
    });
  }

  private tableName(level: BasinLevel, model: Model): string {
    return `basin_${LEVEL_META[level].suffix}_${model}`;
  }

  private validateLevel(level: string): BasinLevel {
    if (!['watershed', 'subbasin-l1', 'subbasin-l2'].includes(level)) {
      throw new BadRequestException(`level must be "watershed", "subbasin-l1", or "subbasin-l2"`);
    }
    return level as BasinLevel;
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

  /** Normalise date: 6months accepts YYYY-MM → YYYY-MM-01 */
  private normaliseDate(date: string, model: Model): string {
    if (model === '6months' && /^\d{4}-\d{2}$/.test(date)) {
      return `${date}-01`;
    }
    return date;
  }

  // GET /basin/dates
  async getDates(model: string): Promise<string[]> {
    const m = this.validateModel(model);
    const table = this.tableName('watershed', m);
    const result = await this.pool.query(
      `SELECT DISTINCT date_sim::text FROM ${table} ORDER BY date_sim`,
    );
    return result.rows.map(r => r.date_sim);
  }

  // GET /basin/:level  — color data (id + value)
  async getColorData(
    level: string,
    model: string,
    mode: string,
    date: string,
    mbCode?: string,
  ): Promise<{ id: string; value: number }[]> {
    const lv = this.validateLevel(level);
    const m  = this.validateModel(model);
    const md = this.validateMode(mode);
    const d  = this.normaliseDate(date, m);

    const { idField } = LEVEL_META[lv];
    const valueField  = MODE_FIELD[md];
    const table       = this.tableName(lv, m);

    const params: any[] = [d];
    let where = 'WHERE date_sim = $1';
    if (mbCode && lv !== 'watershed') {
      params.push(mbCode);
      where += ` AND mb_code = $2`;
    }

    const result = await this.pool.query(
      `SELECT DISTINCT ON (${idField}) ${idField}::text AS id, ${valueField} AS value
       FROM ${table} ${where}
       ORDER BY ${idField}`,
      params,
    );
    return result.rows;
  }

  // GET /basin/:level/detail — full rows for sidebar list
  async getDetail(
    level: string,
    model: string,
    date: string,
    mbCode?: string,
  ): Promise<any[]> {
    const lv = this.validateLevel(level);
    const m  = this.validateModel(model);
    const d  = this.normaliseDate(date, m);

    const { idField, nameField } = LEVEL_META[lv];
    const table = this.tableName(lv, m);

    const params: any[] = [d];
    let where = 'WHERE date_sim = $1';
    if (mbCode && lv !== 'watershed') {
      params.push(mbCode);
      where += ` AND mb_code = $2`;
    }

    // Always return a 'name' column — fall back to id cast when no name field exists (e.g. subbasin-l2)
    const nameCol = nameField ? `${nameField} AS name,` : `${idField}::text AS name,`;
    const result = await this.pool.query(
      `SELECT DISTINCT ON (${idField})
         ${idField}::text AS id,
         ${nameCol}
         mb_code,
         mb_name_t,
         rainfall,
         watersupply,
         reservoir,
         water_demand,
         water_balance,
         drought_index,
         runoff_index
       FROM ${table} ${where}
       ORDER BY ${idField}`,
      params,
    );
    return result.rows;
  }
}
