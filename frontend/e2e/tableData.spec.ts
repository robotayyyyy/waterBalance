/**
 * Table data integrity tests.
 * Verifies:
 *   1. Table rows displayed in the UI match the API /detail response.
 *   2. Exported CSV matches the API response (ProtoLayout export format).
 *
 * Route: /forecast/yom (ProtoLayout, basin subbasin-l1 default).
 * Requires dev server on port 3000.
 *
 * ProtoLayout CSV format (9 columns, mode-independent):
 *   ID, Name, Rainfall, WaterSupply, Reservoir, WaterDemand,
 *   WaterBalance, DroughtIndex, RunoffIndex
 *
 * Mode options testids: mode-dropdown-option-{drought|runoff|waterbalance}
 * Export button testid: export-csv-btn  (ProtoLayout IconBtn in sidebar)
 */
import { test, expect } from '@playwright/test';
import { waitForMap } from './helpers';
import * as fs from 'fs';

const PAGE = '/forecast/yom';

// ─── Helpers ─────────────────────────────────────────────────────────────────

function parseCSV(text: string): { headers: string[]; rows: string[][] } {
  const lines = text.trim().split('\n').map(l => l.trim()).filter(Boolean);
  const headers = lines[0].split(',').map(h => h.trim().replace(/^"|"$/g, ''));
  const rows = lines.slice(1).map(line => {
    const cols: string[] = [];
    let cur = '', inQuote = false;
    for (const ch of line) {
      if (ch === '"') { inQuote = !inQuote; }
      else if (ch === ',' && !inQuote) { cols.push(cur.trim()); cur = ''; }
      else { cur += ch; }
    }
    cols.push(cur.trim());
    return cols;
  });
  return { headers, rows };
}

/**
 * Pick date index 1 (different from the auto-selected latest) and wait for
 * the /detail API response that follows. Falls back to index 0 if only one date.
 */
async function pickDateAndWaitForDetail(page: import('@playwright/test').Page) {
  await page.waitForFunction(
    () => {
      const btn = document.querySelector('[data-testid="date-dropdown"]');
      return btn && btn.textContent?.trim() !== '—';
    },
    { timeout: 15_000 },
  );
  await page.getByTestId('date-dropdown').click();
  const options = page.locator('[data-testid^="date-dropdown-option-"]');
  await options.first().waitFor({ state: 'visible', timeout: 8_000 });

  const count = await options.count();
  const idx = count > 1 ? 1 : 0;

  const detailPromise = page.waitForResponse(
    r => r.url().includes('/detail'),
    { timeout: 12_000 },
  );
  await options.nth(idx).click();
  const detailResponse = await detailPromise;
  await page.waitForTimeout(600);
  return detailResponse;
}

async function switchMode(page: import('@playwright/test').Page, mode: 'drought' | 'runoff' | 'waterbalance') {
  await page.getByTestId('mode-dropdown').click();
  await page.getByTestId(`mode-dropdown-option-${mode}`).click();
  await page.waitForTimeout(400);
}

// ─── Table data tests ─────────────────────────────────────────────────────────

test.describe('Table data correctness', () => {
  test.beforeEach(async ({ page }) => {
    await page.addInitScript(() => localStorage.setItem('lang', 'en'));
    await page.goto(PAGE);
    await waitForMap(page);
  });

  test('basin subbasin-l1 table rows match API detail response', async ({ page }) => {
    const detailResponse = await pickDateAndWaitForDetail(page);
    const apiRows: any[] = await detailResponse.json();
    expect(apiRows.length).toBeGreaterThan(0);

    await page.getByTestId('side-table').waitFor({ state: 'visible', timeout: 8_000 });

    // Row count matches
    const domRows = page.locator('[data-testid^="table-row-"]');
    await expect(domRows).toHaveCount(apiRows.length);

    // Spot-check: find each API row in the DOM by id
    const firstApi = apiRows[0];
    const firstRow = page.getByTestId(`table-row-${firstApi.id}`);
    await expect(firstRow).toBeVisible();

    const cells = firstRow.locator('td');
    const nameCell = await cells.first().innerText();
    expect(nameCell.trim()).toContain(firstApi.name);
  });

  test('waterbalance mode: wb_level badge shows correct label for each row', async ({ page }) => {
    await switchMode(page, 'waterbalance');

    const detailResponse = await pickDateAndWaitForDetail(page);
    const apiRows: any[] = await detailResponse.json();

    await page.getByTestId('side-table').waitFor({ state: 'visible', timeout: 8_000 });

    const WB_LABELS: Record<number, string> = {
      0: 'No water deficit',
      1: 'Slight water deficit',
      2: 'Moderate water deficit',
      3: 'Water deficit',
      4: 'Quite large water deficit',
      5: 'Large water deficit',
      6: 'Severe deficit',
    };

    for (const apiRow of apiRows.slice(0, 5)) {
      const row = page.getByTestId(`table-row-${apiRow.id}`);
      const expectedLabel = WB_LABELS[Math.round(Number(apiRow.wb_level))] ?? '-';
      await expect(row).toContainText(expectedLabel);
    }
  });

  test('drought mode: 8 columns with drought_index first and runoff_index at col 4', async ({ page }) => {
    await switchMode(page, 'drought');
    await pickDateAndWaitForDetail(page);
    await page.getByTestId('side-table').waitFor({ state: 'visible', timeout: 8_000 });

    const headers = page.locator('[data-testid="side-table"] thead th');
    const texts = await headers.allInnerTexts();
    const norm = texts.map(h => h.replace(/[▲▼]/g, '').trim().toLowerCase());

    expect(norm).toHaveLength(8);
    expect(norm[1]).toContain('drought');
    expect(norm[2]).toContain('water');   // waterbalance
    expect(norm[3]).toContain('runoff');
    expect(norm[4]).toContain('demand');
    expect(norm[5]).toContain('supply');
    expect(norm[6]).toContain('rain');
    expect(norm[7]).toContain('reservoir');
  });

  test('runoff mode: 8 columns with runoff_index first and drought_index at col 4', async ({ page }) => {
    await switchMode(page, 'runoff');
    await pickDateAndWaitForDetail(page);
    await page.getByTestId('side-table').waitFor({ state: 'visible', timeout: 8_000 });

    const headers = page.locator('[data-testid="side-table"] thead th');
    const texts = await headers.allInnerTexts();
    const norm = texts.map(h => h.replace(/[▲▼]/g, '').trim().toLowerCase());

    expect(norm).toHaveLength(8);
    expect(norm[1]).toContain('runoff');
    expect(norm[2]).toContain('water');   // waterbalance
    expect(norm[3]).toContain('drought');
  });
});

// ─── CSV export tests ─────────────────────────────────────────────────────────
// ProtoLayout's handleExportCsv — mode-aware, matches SideTable column order.
// waterbalance mode (default): Code, Name EN, Name TH, WaterBalance, Drought, Runoff,
//   WaterDemand, WaterSupply, Rainfall, Reservoir  (10 columns)

test.describe('CSV export correctness', () => {
  test.beforeEach(async ({ page }) => {
    await page.addInitScript(() => localStorage.setItem('lang', 'en'));
    await page.goto(PAGE);
    await waitForMap(page);
  });

  test('exported CSV row count matches API detail response', async ({ page }) => {
    const detailResponse = await pickDateAndWaitForDetail(page);
    const apiRows: any[] = await detailResponse.json();

    const downloadPromise = page.waitForEvent('download');
    await page.getByTestId('export-csv-btn').click();
    const download = await downloadPromise;

    const { rows } = parseCSV(fs.readFileSync((await download.path())!, 'utf-8'));
    expect(rows).toHaveLength(apiRows.length);
  });

  async function exportHeaders(page: import('@playwright/test').Page) {
    const downloadPromise = page.waitForEvent('download');
    await page.getByTestId('export-csv-btn').click();
    const download = await downloadPromise;
    const { headers } = parseCSV(fs.readFileSync((await download.path())!, 'utf-8'));
    return headers;
  }

  const EXPECTED_COLS = {
    count: 10,
    checks: [
      (h: string) => h === 'ID', // col 0 ID
      (h: string) => h.toLowerCase().includes('en'),         // col 1 name EN
      (h: string) => h.toLowerCase().includes('th'),         // col 2 name TH
      (h: string) => h.toLowerCase().includes('water'),      // col 3 waterbalance
      (h: string) => h.toLowerCase().includes('drought'),    // col 4
      (h: string) => h.toLowerCase().includes('runoff'),     // col 5
      (h: string) => h.toLowerCase().includes('demand'),     // col 6
      (h: string) => h.toLowerCase().includes('supply'),     // col 7
      (h: string) => h.toLowerCase().includes('rain'),       // col 8
      (h: string) => h.toLowerCase().includes('reservoir'),  // col 9
    ],
  };

  for (const mode of ['waterbalance', 'drought', 'runoff'] as const) {
    test(`${mode} mode CSV: identical 10-column structure`, async ({ page }) => {
      await switchMode(page, mode);
      await pickDateAndWaitForDetail(page);

      const headers = await exportHeaders(page);
      expect(headers).toHaveLength(EXPECTED_COLS.count);
      EXPECTED_COLS.checks.forEach((check, i) => expect(check(headers[i])).toBe(true));
    });
  }

  test('waterbalance CSV: EN name, TH name, and wb_level values match API', async ({ page }) => {
    await switchMode(page, 'waterbalance');
    const detailResponse = await pickDateAndWaitForDetail(page);
    const apiRows: any[] = await detailResponse.json();

    const downloadPromise = page.waitForEvent('download');
    await page.getByTestId('export-csv-btn').click();
    const download = await downloadPromise;

    const { rows } = parseCSV(fs.readFileSync((await download.path())!, 'utf-8'));

    for (const csvRow of rows.slice(0, 5)) {
      const csvNameEN = csvRow[1];
      const apiRow = apiRows.find((r: any) => r.name === csvNameEN);
      expect(apiRow).toBeTruthy();
      // col 0 = code, col 2 = TH name
      expect(csvRow[2]).toBe(apiRow.name_th ?? '');
      // col 3 = wb_level (NUMERIC — compare as float)
      expect(Number(csvRow[3])).toBeCloseTo(Number(apiRow.wb_level), 4);
      // col 4 = drought_index, col 5 = runoff_index (INTEGER)
      expect(Number(csvRow[4])).toBe(Number(apiRow.drought_index));
      expect(Number(csvRow[5])).toBe(Number(apiRow.runoff_index));
    }
  });
});
