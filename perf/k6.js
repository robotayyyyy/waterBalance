/**
 * WaterF performance test
 *
 * Two scenarios run in parallel:
 *   normal_user  — page load → browse dates → view data (realistic pacing)
 *   heavy_user   — spams mode switches + date changes with minimal sleep (max DB load)
 *
 * Usage:
 *   k6 run perf/k6.js                           # default (load stage)
 *   k6 run -e STAGE=smoke   perf/k6.js          # 1 VU, 1 min
 *   k6 run -e STAGE=load    perf/k6.js          # ramp to 20 VUs
 *   k6 run -e STAGE=stress  perf/k6.js          # ramp to 100 VUs
 *   k6 run -e BASE_URL=http://1.2.3.4 perf/k6.js
 */

import http from 'k6/http';
import { sleep, check, group } from 'k6';
import { Rate, Trend } from 'k6/metrics';

// ── Config ────────────────────────────────────────────────────────────────────

const BASE  = __ENV.BASE_URL || 'http://localhost';
const STAGE = __ENV.STAGE   || 'load';

// heavy_user gets 30% of VUs, normal_user gets 70%
const STAGES = {
  smoke: {
    normal: [{ duration: '1m', target: 1 }],
    heavy:  [{ duration: '1m', target: 1 }],
  },
  load: {
    normal: [
      { duration: '1m', target: 5  },
      { duration: '3m', target: 14 },
      { duration: '1m', target: 0  },
    ],
    heavy: [
      { duration: '1m', target: 2 },
      { duration: '3m', target: 6 },
      { duration: '1m', target: 0 },
    ],
  },
  stress: {
    normal: [
      { duration: '1m', target: 10 },
      { duration: '2m', target: 20 },
      { duration: '2m', target: 40 },
      { duration: '2m', target: 70 },
      { duration: '2m', target: 0  },
    ],
    heavy: [
      { duration: '1m', target: 5  },
      { duration: '2m', target: 10 },
      { duration: '2m', target: 20 },
      { duration: '2m', target: 30 },
      { duration: '2m', target: 0  },
    ],
  },
};

const stage = STAGES[STAGE] || STAGES.load;

export const options = {
  scenarios: {
    normal_user: {
      executor:        'ramping-vus',
      stages:          stage.normal,
      gracefulRampDown: '30s',
      exec:            'normalUser',
    },
    heavy_user: {
      executor:        'ramping-vus',
      stages:          stage.heavy,
      gracefulRampDown: '30s',
      exec:            'heavyUser',
    },
  },
  thresholds: {
    http_req_duration:            ['p(95)<3000'],
    http_req_failed:              ['rate<0.05'],
    errors:                       ['rate<0.05'],
    'api_duration_ms{scenario:heavy_user}': ['p(95)<5000'],
  },
};

// ── Metrics ───────────────────────────────────────────────────────────────────

const errors  = new Rate('errors');
const apiTime = new Trend('api_duration_ms', true);

// ── Constants ─────────────────────────────────────────────────────────────────

const WATERSHEDS = ['ping', 'yom'];
const MB_CODES   = { ping: '06', yom: '08' };
const MODES      = ['waterbalance', 'drought', 'runoff'];
const MODELS     = ['7days', '6months'];

// ── Helpers ───────────────────────────────────────────────────────────────────

function pick(arr) {
  return arr[Math.floor(Math.random() * arr.length)];
}

function pickDifferent(arr, current) {
  const others = arr.filter(v => v !== current);
  return pick(others);
}

function get(url, tag) {
  const res = http.get(url, { tags: { name: tag } });
  const failed = res.status < 200 || res.status >= 300;
  errors.add(failed);
  return res;
}

function fetchDates(model) {
  const res = get(`${BASE}/api/basin/dates?model=${model}`, 'basin_dates');
  try {
    const body = res.json();
    return Array.isArray(body) ? body : [];
  } catch (_) {
    return [];
  }
}

function fetchColors(ws, date, mode, model) {
  const mb  = MB_CODES[ws];
  const url = `${BASE}/api/basin/subbasin-l1?date=${date}&mode=${mode}&model=${model}&mb_code=${mb}`;
  const res = get(url, 'basin_colors');
  apiTime.add(res.timings.duration);
  check(res, { 'colors 200': r => r.status === 200 });
}

function fetchDetail(ws, date, model) {
  const mb  = MB_CODES[ws];
  const url = `${BASE}/api/basin/subbasin-l1/detail?date=${date}&model=${model}&mb_code=${mb}`;
  const res = get(url, 'basin_detail');
  apiTime.add(res.timings.duration);
  check(res, { 'detail 200': r => r.status === 200 });
}

// ── Normal user scenario ──────────────────────────────────────────────────────
// Simulates a regular user: load page, pick a date, look at data, maybe switch
// mode once, then leave. Realistic pacing with 1-2s sleeps.

export function normalUser() {
  const ws    = pick(WATERSHEDS);
  const model = pick(MODELS);
  let   mode  = pick(MODES);

  group('page', () => {
    const res = get(`${BASE}/forecast/${ws}`, 'page_load');
    check(res, { 'page 200': r => r.status === 200 });
  });

  sleep(1);

  const dates = fetchDates(model);
  if (dates.length === 0) return;
  const date = pick(dates);

  sleep(1);

  fetchColors(ws, date, mode, model);
  sleep(0.5);
  fetchDetail(ws, date, model);

  sleep(2);

  // 50% chance: switch mode once
  if (Math.random() < 0.5) {
    mode = pickDifferent(MODES, mode);
    fetchColors(ws, date, mode, model);
    sleep(0.5);
    fetchDetail(ws, date, model);
    sleep(2);
  }
}

// ── Heavy user scenario ───────────────────────────────────────────────────────
// Simulates an analyst hammering the system: rapidly switches modes and jumps
// between dates, causing a new DB query on every action. Minimal sleep.

export function heavyUser() {
  const ws    = pick(WATERSHEDS);
  const model = pick(MODELS);

  const dates = fetchDates(model);
  if (dates.length === 0) return;

  let mode = pick(MODES);
  let date = pick(dates);

  // Initial view
  fetchColors(ws, date, mode, model);
  fetchDetail(ws, date, model);
  sleep(0.2);

  // Rapidly switch mode 4 times
  for (let i = 0; i < 4; i++) {
    mode = pickDifferent(MODES, mode);
    group('mode_switch', () => {
      fetchColors(ws, date, mode, model);
      fetchDetail(ws, date, model);
    });
    sleep(0.2);
  }

  // Jump between 5 different dates
  for (let i = 0; i < 5; i++) {
    date = pick(dates);
    group('date_change', () => {
      fetchColors(ws, date, mode, model);
      fetchDetail(ws, date, model);
    });
    sleep(0.2);
  }

  // Final burst: alternate mode + date together (worst case for DB)
  for (let i = 0; i < 3; i++) {
    mode = pickDifferent(MODES, mode);
    date = pick(dates);
    group('mode_and_date', () => {
      fetchColors(ws, date, mode, model);
      fetchDetail(ws, date, model);
    });
    sleep(0.1);
  }

  sleep(1);
}

// ── Setup: verify connectivity ────────────────────────────────────────────────

export function setup() {
  const res = http.get(`${BASE}/nginx-health`);
  if (res.status === 200) {
    console.log(`✓ Connected to ${BASE}`);
  } else {
    console.warn(`⚠ Unexpected status ${res.status} from ${BASE}/nginx-health — proceeding anyway`);
  }
  return {};
}
