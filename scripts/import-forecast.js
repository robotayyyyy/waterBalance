#!/usr/bin/env node
/**
 * Import forecast CSVs into DB (7days tables only).
 *
 * Usage:  node scripts/import-forecast.js
 *
 * Reads:  forecastdata/province_analyze.csv  → forecast_province_7days
 *         forecastdata/amphoe_analyze.csv    → forecast_amphoe_7days
 *         forecastdata/tambon_analyze.csv    → forecast_tambon_7days
 *
 * Requires: node, pg in backend/node_modules
 * Run from project root with DB running (make db or make up).
 */

'use strict';

const fs   = require('fs');
const path = require('path');
const { Pool } = require('../backend/node_modules/pg');

// ── Config ─────────────────────────────────────────────────────────────────

const DB = {
  host:     process.env.DATABASE_HOST     || 'localhost',
  port:     parseInt(process.env.DATABASE_PORT || '5432'),
  user:     process.env.DATABASE_USER     || 'postgres',
  password: process.env.DATABASE_PASSWORD || 'postgres',
  database: process.env.DATABASE_NAME     || 'postgres',
};

const BATCH = 500; // rows per INSERT

// ── Helpers ─────────────────────────────────────────────────────────────────

/** Strip UTF-8 BOM and parse CSV into array of header+row objects */
function parseCSV(filePath) {
  const raw = fs.readFileSync(filePath, 'utf8').replace(/^\uFEFF/, '');
  const lines = raw.split(/\r?\n/).filter(l => l.trim());
  const headers = lines[0].split(',').map(h => h.trim());
  return lines.slice(1).map(line => {
    const cols = line.split(',');
    const row = {};
    headers.forEach((h, i) => { row[h] = (cols[i] ?? '').trim(); });
    return row;
  });
}

/** Convert DD/MM/YYYY → YYYY-MM-DD */
function parseDate(s) {
  const [d, m, y] = s.split('/');
  return `${y}-${m.padStart(2, '0')}-${d.padStart(2, '0')}`;
}

/** Batch-insert rows using parameterised VALUES lists */
async function batchInsert(client, table, columns, rows) {
  let inserted = 0;
  for (let i = 0; i < rows.length; i += BATCH) {
    const chunk = rows.slice(i, i + BATCH);
    const placeholders = chunk.map((_, ri) =>
      `(${columns.map((_, ci) => `$${ri * columns.length + ci + 1}`).join(',')})`
    ).join(',');
    const values = chunk.flatMap(r => columns.map(c => r[c]));
    await client.query(
      `INSERT INTO ${table} (${columns.join(',')}) VALUES ${placeholders}`,
      values
    );
    inserted += chunk.length;
    process.stdout.write(`\r  ${inserted} / ${rows.length} rows`);
  }
  console.log(`\r  ✓ ${inserted} rows inserted into ${table}     `);
}

// ── Import functions ─────────────────────────────────────────────────────────

function buildProvince(raw) {
  return raw.map(r => ({
    date_sim:      parseDate(r['DateSim']),
    province_id:   r['Province_ID'],
    province:      r['Province'],
    date_forecast: r['DateForecast'],
    rainfall:      r['Daily_Rainfall'] || null,   // province CSV uses Daily_Rainfall
    watersupply:   r['Watersupply']    || null,
    reservoir:     r['Reservoir']      || null,
    water_demand:  r['WaterDemand']    || null,
    water_balance: r['WaterBalance']   || null,
    drought_index: r['DroughtIndex']   || null,
    runoff_index:  r['RunoffIndex']    || null,
  }));
}

function buildAmphoe(raw) {
  return raw.map(r => ({
    date_sim:      parseDate(r['DateSim']),
    amphoe_id:     r['Amphoe_ID'],
    amphoe:        r['Amphoe'],
    province_id:   r['Province_ID'],
    province:      r['Province'],
    date_forecast: r['DateForecast'],
    rainfall:      r['Rainfall']    || null,
    watersupply:   r['Watersupply'] || null,
    reservoir:     r['Reservoir']   || null,
    water_demand:  r['WaterDemand'] || null,
    water_balance: r['WaterBalance']|| null,
    drought_index: r['DroughtIndex']|| null,
    runoff_index:  r['RunoffIndex'] || null,
  }));
}

function buildTambon(raw) {
  return raw.map(r => ({
    date_sim:      parseDate(r['DateSim']),
    tambon_id:     r['Tambon_ID'],
    tambon:        r['Tambon'],
    amphoe_id:     r['Amphoe_ID'],
    amphoe:        r['Amphoe'],
    province_id:   r['Province_ID'],
    province:      r['Province'],
    date_forecast: r['DateForecast'],
    rainfall:      r['Rainfall']    || null,
    watersupply:   r['Watersupply'] || null,
    reservoir:     r['Reservoir']   || null,
    water_demand:  r['WaterDemand'] || null,
    water_balance: r['WaterBalance']|| null,
    drought_index: r['DroughtIndex']|| null,
    runoff_index:  r['RunoffIndex'] || null,
  }));
}

// ── Main ─────────────────────────────────────────────────────────────────────

async function main() {
  const pool = new Pool(DB);
  const client = await pool.connect();

  try {
    const root = path.join(__dirname, '..');

    // Province
    console.log('\n[1/3] province_analyze.csv → forecast_province_7days');
    const provinceRaw = parseCSV(path.join(root, 'forecastdata/province_analyze.csv'));
    const provinceRows = buildProvince(provinceRaw);
    await client.query('TRUNCATE forecast_province_7days RESTART IDENTITY');
    await batchInsert(client, 'forecast_province_7days',
      ['date_sim','province_id','province','date_forecast','rainfall','watersupply','reservoir','water_demand','water_balance','drought_index','runoff_index'],
      provinceRows
    );

    // Amphoe
    console.log('\n[2/3] amphoe_analyze.csv → forecast_amphoe_7days');
    const amphoeRaw = parseCSV(path.join(root, 'forecastdata/amphoe_analyze.csv'));
    const amphoeRows = buildAmphoe(amphoeRaw);
    await client.query('TRUNCATE forecast_amphoe_7days RESTART IDENTITY');
    await batchInsert(client, 'forecast_amphoe_7days',
      ['date_sim','amphoe_id','amphoe','province_id','province','date_forecast','rainfall','watersupply','reservoir','water_demand','water_balance','drought_index','runoff_index'],
      amphoeRows
    );

    // Tambon
    console.log('\n[3/3] tambon_analyze.csv → forecast_tambon_7days');
    const tambonRaw = parseCSV(path.join(root, 'forecastdata/tambon_analyze.csv'));
    const tambonRows = buildTambon(tambonRaw);
    await client.query('TRUNCATE forecast_tambon_7days RESTART IDENTITY');
    await batchInsert(client, 'forecast_tambon_7days',
      ['date_sim','tambon_id','tambon','amphoe_id','amphoe','province_id','province','date_forecast','rainfall','watersupply','reservoir','water_demand','water_balance','drought_index','runoff_index'],
      tambonRows
    );

    console.log('\nDone.\n');
  } finally {
    client.release();
    await pool.end();
  }
}

main().catch(err => { console.error(err); process.exit(1); });
