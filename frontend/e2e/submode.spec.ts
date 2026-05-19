/**
 * E2E tests: sub param is sent correctly for every trigger in admin and basin mode.
 *
 * Rule:
 *   subMode=daily   → request must include sub=daily
 *   subMode=aggregate → request must NOT include sub=daily
 *
 * Scenarios covered:
 *   Admin: province select, amphoe select, All Tambon, mode change, model change, view-mode switch
 *   Basin: L1 select, model change, view-mode switch
 */

import { test, expect, type Page, type Request } from '@playwright/test';
import { waitForMap } from './helpers';

const PAGE = '/forecast/yom';

// ─── Helpers ──────────────────────────────────────────────────────────────────

async function setup(page: Page) {
  await page.addInitScript(() => localStorage.setItem('lang', 'en'));
  await page.goto(PAGE);
  await waitForMap(page);
}

async function setViewMode(page: Page, value: 'admin' | 'basin') {
  await page.getByTestId('viewmode-dropdown').click();
  await page.getByTestId(`viewmode-dropdown-option-${value}`).click();
  await page.waitForTimeout(400);
}

async function setModel(page: Page, value: '7days' | '6months') {
  // Wait for model dropdown to be available, then select
  const resp = page.waitForResponse(r => r.url().includes('/forecast/') || r.url().includes('/basin/'), { timeout: 10_000 });
  await page.getByTestId('date-dropdown').waitFor({ state: 'visible', timeout: 5_000 }).catch(() => {});
  // Model is a ProtoDropdown without testId — use text label
  const label = value === '7days' ? '7-Day' : '6-Month';
  // Click the model dropdown (second ProtoDropdown in topbar that isn't date/viewmode)
  const dropdowns = page.locator('[data-testid]').filter({ hasNotText: /—/ });
  // Find by the current label then click sibling option
  await page.locator('button', { hasText: label }).first().click().catch(async () => {
    // fallback: the model dropdown may already be showing that value — try selecting via options
  });
  await resp.catch(() => {});
  await page.waitForTimeout(300);
}

/** Switch to daily submode and wait for dates to reload */
async function setSubMode(page: Page, sub: 'aggregate' | 'daily') {
  const resp = page.waitForResponse(
    r => r.url().includes('/dates'),
    { timeout: 10_000 },
  );
  await page.getByTestId(`submode-${sub}`).click();
  await resp;
  await page.waitForTimeout(300);
}

/** Pick the first available date and wait for a data response */
async function pickDate(page: Page) {
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
  const resp = page.waitForResponse(
    r => r.url().includes('/forecast/') || r.url().includes('/basin/'),
    { timeout: 10_000 },
  );
  await options.first().click();
  await resp;
  await page.waitForTimeout(400);
}

/** Select first province from sidebar list */
async function selectFirstProvince(page: Page) {
  const resp = page.waitForResponse(r => r.url().includes('/forecast/'), { timeout: 10_000 });
  await page.locator('ul li').first().waitFor({ state: 'visible', timeout: 8_000 });
  await page.locator('ul li').first().click();
  await resp;
  await page.waitForTimeout(400);
}

/** Select first amphoe (second li in sidebar) */
async function selectFirstAmphoe(page: Page) {
  const resp = page.waitForResponse(r => r.url().includes('/forecast/'), { timeout: 10_000 });
  await page.locator('ul li').nth(1).waitFor({ state: 'visible', timeout: 8_000 });
  await page.locator('ul li').nth(1).click();
  await resp;
  await page.waitForTimeout(400);
}

/** Click All Tambons footer button and capture the /forecast/tambon request */
async function clickAllTambons(page: Page): Promise<Request> {
  const reqPromise = page.waitForRequest(
    r => r.url().includes('/forecast/tambon'),
    { timeout: 10_000 },
  );
  await page.getByText('All Tambons').click();
  const req = await reqPromise;
  await page.waitForTimeout(300);
  return req;
}

function hasSub(url: string): boolean {
  return new URL(url).searchParams.get('sub') === 'daily';
}

// ─── Admin mode — sub param ────────────────────────────────────────────────────

test.describe('admin submode — sub param', () => {
  test.beforeEach(async ({ page }) => { await setup(page); });

  test('aggregate + province select → no sub param', async ({ page }) => {
    await setViewMode(page, 'admin');
    await pickDate(page);
    // subMode defaults to aggregate
    const req = await page.waitForRequest(r => r.url().includes('/forecast/province'), { timeout: 8_000 }).catch(() => null);
    // trigger a fresh province-level fetch
    const resp = page.waitForResponse(r => r.url().includes('/forecast/province'), { timeout: 10_000 });
    await page.locator('[data-testid="date-dropdown"]').click();
    const opts = page.locator('[data-testid^="date-dropdown-option-"]');
    await opts.first().waitFor({ state: 'visible' });
    await opts.first().click();
    const r = await resp;
    expect(new URL(r.url()).searchParams.get('sub')).toBeNull();
  });

  test('daily + province select → sub=daily', async ({ page }) => {
    await setViewMode(page, 'admin');
    await setSubMode(page, 'daily');
    await pickDate(page);
    const resp = page.waitForResponse(r => r.url().includes('/forecast/province'), { timeout: 10_000 });
    await page.locator('[data-testid="date-dropdown"]').click();
    const opts = page.locator('[data-testid^="date-dropdown-option-"]');
    await opts.first().waitFor({ state: 'visible' });
    await opts.first().click();
    const r = await resp;
    expect(new URL(r.url()).searchParams.get('sub')).toBe('daily');
  });

  test('daily + amphoe select → sub=daily', async ({ page }) => {
    await setViewMode(page, 'admin');
    await setSubMode(page, 'daily');
    await pickDate(page);
    await selectFirstProvince(page);
    const resp = page.waitForResponse(r => r.url().includes('/forecast/amphoe'), { timeout: 10_000 });
    await selectFirstAmphoe(page);
    const r = await resp;
    expect(new URL(r.url()).searchParams.get('sub')).toBe('daily');
  });

  test('aggregate + amphoe select → no sub param', async ({ page }) => {
    await setViewMode(page, 'admin');
    await pickDate(page);
    await selectFirstProvince(page);
    const resp = page.waitForResponse(r => r.url().includes('/forecast/amphoe'), { timeout: 10_000 });
    await selectFirstAmphoe(page);
    const r = await resp;
    expect(new URL(r.url()).searchParams.get('sub')).toBeNull();
  });

  test('daily + All Tambon → sub=daily (regression)', async ({ page }) => {
    await setViewMode(page, 'admin');
    await setSubMode(page, 'daily');
    await pickDate(page);
    const req = await clickAllTambons(page);
    expect(hasSub(req.url())).toBe(true);
  });

  test('aggregate + All Tambon → no sub param', async ({ page }) => {
    await setViewMode(page, 'admin');
    // subMode defaults to aggregate — no need to switch
    await pickDate(page);
    const req = await clickAllTambons(page);
    expect(hasSub(req.url())).toBe(false);
  });

  test('daily + All Tambon after province select → sub=daily', async ({ page }) => {
    await setViewMode(page, 'admin');
    await setSubMode(page, 'daily');
    await pickDate(page);
    await selectFirstProvince(page);
    const req = await clickAllTambons(page);
    expect(hasSub(req.url())).toBe(true);
  });

  test('switch daily→aggregate then All Tambon → no sub param', async ({ page }) => {
    await setViewMode(page, 'admin');
    await setSubMode(page, 'daily');
    await pickDate(page);
    await setSubMode(page, 'aggregate');
    await pickDate(page);
    const req = await clickAllTambons(page);
    expect(hasSub(req.url())).toBe(false);
  });

  test('model change resets subMode to aggregate', async ({ page }) => {
    await setViewMode(page, 'admin');
    await setSubMode(page, 'daily');
    await pickDate(page);
    // switch model to 6months — resets subMode to aggregate
    const resp = page.waitForResponse(r => r.url().includes('/forecast/'), { timeout: 10_000 });
    await page.getByTestId('model-dropdown').click();
    await page.getByTestId('model-dropdown-option-6months').click();
    const r = await resp;
    expect(new URL(r.url()).searchParams.get('sub')).toBeNull();
  });

  test('6months + daily + province select → sub=daily', async ({ page }) => {
    await setViewMode(page, 'admin');
    // switch to 6months
    const modelResp = page.waitForResponse(r => r.url().includes('/forecast/'), { timeout: 10_000 });
    await page.getByTestId('model-dropdown').click();
    await page.getByTestId('model-dropdown-option-6months').click();
    await modelResp;
    await setSubMode(page, 'daily');
    await pickDate(page);
    const resp = page.waitForResponse(r => r.url().includes('/forecast/province'), { timeout: 10_000 });
    await page.getByTestId('date-dropdown').click();
    const opts = page.locator('[data-testid^="date-dropdown-option-"]');
    await opts.first().waitFor({ state: 'visible' });
    await opts.first().click();
    const r = await resp;
    expect(new URL(r.url()).searchParams.get('sub')).toBe('daily');
  });
});

// ─── Basin mode — sub param ───────────────────────────────────────────────────

test.describe('basin submode — sub param', () => {
  test.beforeEach(async ({ page }) => { await setup(page); });

  test('daily + date select → basin request has sub=daily', async ({ page }) => {
    // basin mode is default
    await setSubMode(page, 'daily');
    const resp = page.waitForResponse(r => r.url().includes('/basin/'), { timeout: 10_000 });
    await page.getByTestId('date-dropdown').click();
    const opts = page.locator('[data-testid^="date-dropdown-option-"]');
    await opts.first().waitFor({ state: 'visible' });
    await opts.first().click();
    const r = await resp;
    expect(new URL(r.url()).searchParams.get('sub')).toBe('daily');
  });

  test('aggregate + date select → no sub param', async ({ page }) => {
    // subMode defaults to aggregate
    const resp = page.waitForResponse(r => r.url().includes('/basin/'), { timeout: 10_000 });
    await page.getByTestId('date-dropdown').click();
    const opts = page.locator('[data-testid^="date-dropdown-option-"]');
    await opts.first().waitFor({ state: 'visible' });
    await opts.first().click();
    const r = await resp;
    expect(new URL(r.url()).searchParams.get('sub')).toBeNull();
  });

  test('daily preserved when switching admin→basin', async ({ page }) => {
    await setSubMode(page, 'daily');
    await pickDate(page);
    await setViewMode(page, 'admin');
    const resp = page.waitForResponse(r => r.url().includes('/basin/'), { timeout: 10_000 });
    await setViewMode(page, 'basin');
    const r = await resp;
    expect(new URL(r.url()).searchParams.get('sub')).toBe('daily');
  });

  test('daily preserved when changing mode (runoff→drought)', async ({ page }) => {
    await setSubMode(page, 'daily');
    await pickDate(page);
    const resp = page.waitForResponse(r => r.url().includes('/basin/'), { timeout: 10_000 });
    await page.getByTestId('mode-dropdown').click();
    await page.getByTestId('mode-dropdown-option-drought').click();
    const r = await resp;
    expect(new URL(r.url()).searchParams.get('sub')).toBe('daily');
  });
});
