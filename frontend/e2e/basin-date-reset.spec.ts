/**
 * E2E tests for basin navigation / mode / date interaction.
 *
 * Rainfall guard (ENABLE_RAINFALL_GUARD):
 *   Whenever state reaches: rainfall mode + past date + not at subbasin-l2
 *   → reset date to current (stay in rainfall) if current date exists
 *   → else switch to waterbalance with default date
 *
 * Microbasin (subbasin-l2) is exempt from the guard — all dates are valid there.
 *
 * Non-rainfall modes have NO date restriction — navigating back with a past date
 * in drought/runoff/waterbalance mode leaves the date unchanged.
 */

import { test, expect } from '@playwright/test';
import { waitForMap } from './helpers';

const PAGE = '/forecast/yom';

async function setup(page: import('@playwright/test').Page) {
  await page.addInitScript(() => localStorage.setItem('lang', 'en'));
  await page.goto(PAGE);
  await waitForMap(page);
}

async function waitForTableRows(page: import('@playwright/test').Page) {
  await page.locator('[data-testid^="table-row-"]').first().waitFor({ state: 'visible', timeout: 15_000 });
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

async function getDateLabel(page: import('@playwright/test').Page): Promise<string> {
  return (await page.getByTestId('date-dropdown').innerText()).trim();
}

/** Navigate watershed → pick first L1 → drill to subbasin-l2 */
async function drillToL2(page: import('@playwright/test').Page) {
  await page.getByTestId('watershed-dropdown').click();
  await page.getByTestId('watershed-dropdown-list').locator('li').first().waitFor({ state: 'visible', timeout: 8_000 });
  await page.getByTestId('watershed-dropdown-list').locator('li').first().click();
  await page.getByTestId('l1-dropdown').waitFor({ state: 'visible', timeout: 8_000 });

  await page.getByTestId('l1-dropdown').click();
  await page.getByTestId('l1-dropdown-list').locator('li').first().waitFor({ state: 'visible', timeout: 8_000 });
  await page.getByTestId('l1-dropdown-list').locator('li').first().click();
  await page.waitForTimeout(300);

  await page.getByTestId('drill-l2-btn').click();
  await waitForTableRows(page);
}

/** Pick the oldest available date (definitely past for 6months model) */
async function pickPastDate(page: import('@playwright/test').Page) {
  await page.getByTestId('date-dropdown').click();
  const options = page.locator('[data-testid^="date-dropdown-option-"]');
  await options.first().waitFor({ state: 'visible', timeout: 8_000 });
  const count = await options.count();
  const resp = page.waitForResponse(
    r => r.url().includes('/basin/') || r.url().includes('/forecast/'),
    { timeout: 10_000 },
  );
  await options.nth(count - 1).click();
  await resp;
  await page.waitForTimeout(400);
}

// ─── Microbasin exemption ──────────────────────────────────────────────────

test.describe('subbasin-l2 rainfall mode — microbasin exemption', () => {
  test.beforeEach(async ({ page }) => { await setup(page); });

  test('rainfall mode enabled at subbasin-l2 even with past date selected', async ({ page }) => {
    await waitForDateReady(page);
    await drillToL2(page);
    await pickPastDate(page);

    await page.getByTestId('mode-dropdown').click();
    await expect(page.getByTestId('mode-dropdown-option-rainfall')).toBeEnabled();
    await page.keyboard.press('Escape');
  });

  test('date picker in rainfall mode at subbasin-l2 shows all dates (not just current+future)', async ({ page }) => {
    await waitForDateReady(page);
    await drillToL2(page);

    await page.getByTestId('mode-dropdown').click();
    await page.getByTestId('mode-dropdown-option-rainfall').click();
    await page.waitForTimeout(300);

    await page.getByTestId('date-dropdown').click();
    const options = page.locator('[data-testid^="date-dropdown-option-"]');
    await options.first().waitFor({ state: 'visible', timeout: 8_000 });
    const allCount = await options.count();
    expect(allCount).toBeGreaterThan(6);
    await page.keyboard.press('Escape');
  });
});

// ─── Rainfall guard ────────────────────────────────────────────────────────

test.describe('rainfall guard — conflict resolution', () => {
  test.beforeEach(async ({ page }) => { await setup(page); });

  test('rainfall + past date at L2: navigate to L1 → guard resets date to current', async ({ page }) => {
    await waitForDateReady(page);
    const currentDate = await getDateLabel(page);

    await drillToL2(page);
    // Switch to rainfall (allowed at L2 for any date)
    await page.getByTestId('mode-dropdown').click();
    await page.getByTestId('mode-dropdown-option-rainfall').click();
    await page.waitForTimeout(300);
    // Pick a past date (date picker shows all dates at L2 in rainfall mode)
    await pickPastDate(page);
    const pastDate = await getDateLabel(page);
    expect(pastDate).not.toBe(currentDate);

    // Navigate up — guard should fire: rainfall + past date + now at L1 → reset to current
    await page.getByTestId('l1-deselect').click();
    await waitForTableRows(page);

    expect(await getDateLabel(page)).toBe(currentDate);
  });

  test('rainfall + past date at L2: switch to admin view → guard resets date to current', async ({ page }) => {
    await waitForDateReady(page);
    const currentDate = await getDateLabel(page);

    await drillToL2(page);
    await page.getByTestId('mode-dropdown').click();
    await page.getByTestId('mode-dropdown-option-rainfall').click();
    await page.waitForTimeout(300);
    await pickPastDate(page);
    const pastDate = await getDateLabel(page);
    expect(pastDate).not.toBe(currentDate);

    // Switch to admin view — no L2 exemption in admin → guard fires
    await page.getByTestId('viewmode-dropdown').click();
    await page.getByTestId('viewmode-dropdown-option-admin').click();
    await waitForTableRows(page);

    expect(await getDateLabel(page)).toBe(currentDate);
  });

  test('non-rainfall + past date at L2: navigate back → date unchanged (guard only covers rainfall)', async ({ page }) => {
    await waitForDateReady(page);
    await drillToL2(page);
    await pickPastDate(page);
    const pastDate = await getDateLabel(page);

    // Navigate back in non-rainfall (drought/waterbalance) mode → guard does not fire
    await page.getByTestId('l1-deselect').click();
    await waitForTableRows(page);

    expect(await getDateLabel(page)).toBe(pastDate);
  });
});

// ─── Current date: no change in any scenario ──────────────────────────────

test.describe('current date — no unintended resets', () => {
  test.beforeEach(async ({ page }) => { await setup(page); });

  test('current date at L2: switch mode → date unchanged', async ({ page }) => {
    await waitForDateReady(page);
    const currentDate = await getDateLabel(page);
    await drillToL2(page);
    expect(await getDateLabel(page)).toBe(currentDate);

    await page.getByTestId('mode-dropdown').click();
    await page.getByTestId('mode-dropdown-option-runoff').click();
    await waitForTableRows(page);

    expect(await getDateLabel(page)).toBe(currentDate);
  });

  test('current date at L2: navigate back → date unchanged', async ({ page }) => {
    await waitForDateReady(page);
    const currentDate = await getDateLabel(page);
    await drillToL2(page);
    expect(await getDateLabel(page)).toBe(currentDate);

    await page.getByTestId('l1-deselect').click();
    await waitForTableRows(page);

    expect(await getDateLabel(page)).toBe(currentDate);
  });
});
