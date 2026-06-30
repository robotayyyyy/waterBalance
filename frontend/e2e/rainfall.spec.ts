/**
 * E2E tests for rainfall mode feature.
 *
 * Covers:
 *   - Rainfall mode option exists in mode dropdown (after waterbalance)
 *   - Rainfall mode disabled when prior date is selected
 *   - In rainfall mode: date picker shows only current date
 *   - Switching out of rainfall mode restores all dates
 *   - Table: rainfall index first, rainfall(mm) second, no drought/runoff/wb columns (6 cols)
 *   - Rainfall index badge visible per row
 *   - Export CSV includes rainfall index column
 *   - Regression: drought/runoff/waterbalance modes show 6 columns (primary index only)
 *
 * Requires:
 *   testid "mode-dropdown-option-rainfall" on rainfall option
 *   testid "rainfall-index-badge" on rainfall index badge cells in SideTable
 */

import { test, expect } from '@playwright/test';
import { waitForMap } from './helpers';
import * as fs from 'fs';

const PAGE = '/forecast/yom';

async function setup(page: import('@playwright/test').Page) {
  await page.addInitScript(() => localStorage.setItem('lang', 'en'));
  await page.goto(PAGE);
  await waitForMap(page);
}

async function switchMode(page: import('@playwright/test').Page, mode: string) {
  await page.getByTestId('mode-dropdown').click();
  await page.getByTestId(`mode-dropdown-option-${mode}`).click();
  await page.waitForTimeout(400);
}

async function waitForDateReady(page: import('@playwright/test').Page) {
  await page.waitForFunction(
    () => {
      const btn = document.querySelector('[data-testid="date-dropdown"]');
      return btn && btn.textContent?.trim() !== '—';
    },
    { timeout: 15_000 },
  );
}

/**
 * Wait for the page to auto-select the current date (via selectDefaultDate on load).
 * Does NOT manually click a date — the page's own init picks the correct "current" date,
 * which is what defines whether rainfall mode is enabled.
 */
async function pickCurrentDate(page: import('@playwright/test').Page) {
  await waitForDateReady(page);
  // Wait for basin data to arrive so the table is populated
  await page.locator('[data-testid^="table-row-"]').first().waitFor({ state: 'visible', timeout: 15_000 });
  await page.waitForTimeout(300);
}

/** Pick the last available date (oldest = definitely prior to current) */
async function pickPriorDate(page: import('@playwright/test').Page) {
  await waitForDateReady(page);
  await page.getByTestId('date-dropdown').click();
  const options = page.locator('[data-testid^="date-dropdown-option-"]');
  await options.first().waitFor({ state: 'visible', timeout: 8_000 });
  const count = await options.count();
  if (count <= 1) {
    // Only one date — close dropdown; can't test prior date scenario
    await page.keyboard.press('Escape');
    return;
  }
  const resp = page.waitForResponse(
    r => r.url().includes('/basin/') || r.url().includes('/forecast/'),
    { timeout: 10_000 },
  );
  await options.last().click();
  await resp;
  await page.waitForTimeout(400);
}

async function getTableHeaders(page: import('@playwright/test').Page) {
  await page.getByTestId('side-table').waitFor({ state: 'visible', timeout: 8_000 });
  const texts = await page.locator('[data-testid="side-table"] thead th').allInnerTexts();
  return texts.map(h => h.replace(/[▲▼⇅]/g, '').trim().toLowerCase());
}

async function switchTo7days(page: import('@playwright/test').Page) {
  await page.getByTestId('model-dropdown').click();
  await page.getByTestId('model-dropdown-option-7days').click();
  await page.locator('[data-testid^="table-row-"]').first().waitFor({ state: 'visible', timeout: 15_000 });
  await page.waitForTimeout(300);
}

// ─── Mode button: existence and access control ────────────────────────────────
// Rainfall is "current data only":
//   6months → latest date in today's calendar month; disabled for any other date
//   7days   → today's exact date; disabled if today's data is absent from the API

test.describe('rainfall mode — button state', () => {
  test.beforeEach(async ({ page }) => { await setup(page); });

  test('rainfall option exists in mode dropdown', async ({ page }) => {
    await page.getByTestId('mode-dropdown').click();
    await expect(page.getByTestId('mode-dropdown-option-rainfall')).toBeVisible();
  });

  // 6months: current month data (2026-06-01) exists in the DB → button enabled
  test('6months: rainfall enabled when current month data exists', async ({ page }) => {
    await pickCurrentDate(page);
    await page.getByTestId('mode-dropdown').click();
    await expect(page.getByTestId('mode-dropdown-option-rainfall')).toBeEnabled();
  });

  // Any non-current date (2022, future months, prior weeks) → disabled
  test('6months: rainfall disabled when a non-current date is selected', async ({ page }) => {
    await pickPriorDate(page);
    await page.getByTestId('mode-dropdown').click();
    await expect(page.getByTestId('mode-dropdown-option-rainfall')).toBeDisabled();
  });

  // 7days: today (2026-06-30) is NOT in the 7days dataset → always disabled
  test('7days: rainfall disabled when today has no data', async ({ page }) => {
    await switchTo7days(page);
    await pickCurrentDate(page);
    await page.getByTestId('mode-dropdown').click();
    await expect(page.getByTestId('mode-dropdown-option-rainfall')).toBeDisabled();
  });
});

// ─── Date picker restriction in rainfall mode ─────────────────────────────────
// In rainfall mode the picker shows only the one valid current date.
// 6months tests suffice; 7days stays in non-rainfall scope (no today data in test env).

test.describe('rainfall mode — date picker', () => {
  test.beforeEach(async ({ page }) => { await setup(page); });

  test('6months: date picker in rainfall mode shows only current+future dates', async ({ page }) => {
    await pickCurrentDate(page);
    await switchMode(page, 'rainfall');
    await page.getByTestId('date-dropdown').click();
    const options = page.locator('[data-testid^="date-dropdown-option-"]');
    await options.first().waitFor({ state: 'visible', timeout: 8_000 });

    const currentMonth = new Date().toISOString().slice(0, 7);
    const testIds = await options.evaluateAll(els =>
      els.map(el => el.getAttribute('data-testid') ?? '')
    );
    const dates = testIds.map(id => id.replace('date-dropdown-option-', ''));
    // All visible dates must be current month or later (no historical past)
    expect(dates.every(d => d.slice(0, 7) >= currentMonth)).toBe(true);
    // Multiple dates shown (current + future forecast months, not just 1)
    expect(dates.length).toBeGreaterThan(1);
    await page.keyboard.press('Escape');
  });

  test('6months: rainfall mode enabled when future month is selected', async ({ page }) => {
    await waitForDateReady(page);
    // Pick the newest available date (first option = most recent = future forecast month)
    await page.getByTestId('date-dropdown').click();
    const options = page.locator('[data-testid^="date-dropdown-option-"]');
    await options.first().waitFor({ state: 'visible', timeout: 8_000 });
    await options.first().click();
    await page.locator('[data-testid^="table-row-"]').first().waitFor({ state: 'visible', timeout: 15_000 });
    await page.waitForTimeout(300);
    await page.getByTestId('mode-dropdown').click();
    await expect(page.getByTestId('mode-dropdown-option-rainfall')).toBeEnabled();
    await page.keyboard.press('Escape');
  });

  test('6months: switching from rainfall to drought restores all dates', async ({ page }) => {
    await pickCurrentDate(page);
    await switchMode(page, 'rainfall');
    await switchMode(page, 'drought');
    await page.getByTestId('date-dropdown').click();
    const options = page.locator('[data-testid^="date-dropdown-option-"]');
    await options.first().waitFor({ state: 'visible', timeout: 8_000 });
    expect(await options.count()).toBeGreaterThan(1);
  });
});

// ─── Table columns in rainfall mode ──────────────────────────────────────────

test.describe('rainfall mode — table columns', () => {
  test.beforeEach(async ({ page }) => { await setup(page); });

  test('6 columns: name, rainfall index, rainfall(mm), demand, supply, reservoir', async ({ page }) => {
    await pickCurrentDate(page);
    await switchMode(page, 'rainfall');
    const headers = await getTableHeaders(page);
    expect(headers).toHaveLength(6);
    expect(headers[1]).toContain('rainfall index');
    expect(headers[2]).toContain('rainfall');
    expect(headers[3]).toContain('demand');
    expect(headers[4]).toContain('supply');
    expect(headers[5]).toContain('reservoir');
  });

  test('no drought, runoff, or water balance columns', async ({ page }) => {
    await pickCurrentDate(page);
    await switchMode(page, 'rainfall');
    const headers = await getTableHeaders(page);
    expect(headers.some(h => h.includes('drought'))).toBe(false);
    expect(headers.some(h => h.includes('runoff'))).toBe(false);
    expect(headers.some(h => h.includes('balance'))).toBe(false);
  });

  test('rainfall index badge visible on first row', async ({ page }) => {
    await pickCurrentDate(page);
    await switchMode(page, 'rainfall');
    await page.getByTestId('side-table').waitFor({ state: 'visible', timeout: 8_000 });
    const firstRow = page.locator('[data-testid^="table-row-"]').first();
    await expect(firstRow.locator('[data-testid="rainfall-index-badge"]').first()).toBeVisible();
  });
});

// ─── CSV export in rainfall mode ──────────────────────────────────────────────

test.describe('rainfall mode — CSV export', () => {
  test.beforeEach(async ({ page }) => { await setup(page); });

  test('CSV includes rainfall index column', async ({ page }) => {
    await pickCurrentDate(page);
    await switchMode(page, 'rainfall');
    await page.getByTestId('side-table').waitFor({ state: 'visible', timeout: 8_000 });
    const downloadPromise = page.waitForEvent('download');
    await page.getByTestId('export-csv-btn').click();
    const download = await downloadPromise;
    const text = fs.readFileSync((await download.path())!, 'utf-8');
    expect(text.toLowerCase()).toContain('rainfall index');
  });
});

// ─── Regression: existing modes show 6 columns (primary index only) ───────────

test.describe('regression — existing modes table columns', () => {
  test.beforeEach(async ({ page }) => { await setup(page); });

  test('drought mode: 6 columns, drought index first', async ({ page }) => {
    await switchMode(page, 'drought');
    await pickCurrentDate(page);
    const headers = await getTableHeaders(page);
    expect(headers).toHaveLength(6);
    expect(headers[1]).toContain('drought');
    expect(headers.some(h => h.includes('runoff'))).toBe(false);
    expect(headers.some(h => h.includes('balance'))).toBe(false);
  });

  test('runoff mode: 6 columns, runoff index first', async ({ page }) => {
    await switchMode(page, 'runoff');
    await pickCurrentDate(page);
    const headers = await getTableHeaders(page);
    expect(headers).toHaveLength(6);
    expect(headers[1]).toContain('runoff');
    expect(headers.some(h => h.includes('drought'))).toBe(false);
    expect(headers.some(h => h.includes('balance'))).toBe(false);
  });

  test('waterbalance mode: 6 columns, water balance first', async ({ page }) => {
    await switchMode(page, 'waterbalance');
    await pickCurrentDate(page);
    const headers = await getTableHeaders(page);
    expect(headers).toHaveLength(6);
    expect(headers[1]).toContain('water');
    expect(headers.some(h => h.includes('drought'))).toBe(false);
    expect(headers.some(h => h.includes('runoff'))).toBe(false);
  });
});
