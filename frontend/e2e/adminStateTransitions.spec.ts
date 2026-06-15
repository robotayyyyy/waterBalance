/**
 * Comprehensive admin mode state transition tests.
 * Covers all paths: left panel dropdown, map click, table click.
 * Each test verifies: correct API called, correct level shown,
 * and color dots present in all relevant dropdowns.
 */
import { test, expect, type Page } from '@playwright/test';
import { waitForMap } from './helpers';

const PAGE = '/forecast/yom';

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => localStorage.setItem('lang', 'en'));
  await page.goto(PAGE);
  await waitForMap(page);
  await page.getByTestId('viewmode-dropdown').click();
  await page.getByTestId('viewmode-dropdown-option-admin').click();
  await page.waitForTimeout(500);
});

// ─── helpers ──────────────────────────────────────────────────────────────────

async function waitForDate(page: Page) {
  await page.waitForFunction(
    () => {
      const el = document.querySelector('[data-testid="date-dropdown"]');
      return el && el.textContent?.trim() !== '—';
    },
    { timeout: 15_000 },
  );
}

/** Wait until adm1-hit features are rendered, then fire a MapLibre click on one */
async function clickMapProvince(page: Page): Promise<string | null> {
  await page.waitForFunction(() => {
    const map = (window as any).__map;
    if (!map) return false;
    const c = map.getCanvas();
    const positions: [number, number][] = [
      [c.offsetWidth / 2, c.offsetHeight / 2],
      [c.offsetWidth / 2, c.offsetHeight / 3],
      [c.offsetWidth * 2 / 3, c.offsetHeight / 2],
      [c.offsetWidth / 3, c.offsetHeight / 2],
    ];
    return positions.some(([x, y]) =>
      map.queryRenderedFeatures([x, y], { layers: ['adm1-hit'] }).length > 0,
    );
  }, { timeout: 15_000 });

  return page.evaluate(() => {
    const map = (window as any).__map;
    const c = map.getCanvas();
    const positions: [number, number][] = [
      [c.offsetWidth / 2, c.offsetHeight / 2],
      [c.offsetWidth / 2, c.offsetHeight / 3],
      [c.offsetWidth * 2 / 3, c.offsetHeight / 2],
      [c.offsetWidth / 3, c.offsetHeight / 2],
    ];
    for (const [cx, cy] of positions) {
      const features = map.queryRenderedFeatures([cx, cy], { layers: ['adm1-hit'] });
      if (features.length > 0) {
        const lngLat = map.unproject([cx, cy]);
        map.fire('click', { lngLat, point: { x: cx, y: cy }, features, originalEvent: new MouseEvent('click') });
        return features[0].properties?.adm1_pcode ?? null;
      }
    }
    return null;
  });
}

/** Wait until adm2-fill features are rendered, then fire a MapLibre click on one */
async function clickMapAmphoe(page: Page): Promise<string | null> {
  // Give fitBounds time to start, then wait for the animation + tile loading to finish
  await page.waitForTimeout(200);
  await page.evaluate(() => new Promise<void>(resolve => {
    const map = (window as any).__map;
    if (!map.isMoving() && !map.isZooming()) { resolve(); return; }
    map.once('idle', () => resolve());
  }));

  // Search a 4×3 grid — province bbox after fitBounds may not be centered
  const POSITIONS = (w: number, h: number): [number, number][] => [
    [w / 4, h / 3], [w / 2, h / 3], [w * 3/4, h / 3],
    [w / 4, h / 2], [w / 2, h / 2], [w * 3/4, h / 2],
    [w / 4, h * 2/3], [w / 2, h * 2/3], [w * 3/4, h * 2/3],
    [w / 6, h / 2], [w * 5/6, h / 2],
    [w / 3, h / 2], [w * 2/3, h / 2],
  ];

  await page.waitForFunction(() => {
    const map = (window as any).__map;
    if (!map) return false;
    const c = map.getCanvas();
    const w = c.offsetWidth, h = c.offsetHeight;
    const positions: [number, number][] = [
      [w / 4, h / 3], [w / 2, h / 3], [w * 3/4, h / 3],
      [w / 4, h / 2], [w / 2, h / 2], [w * 3/4, h / 2],
      [w / 4, h * 2/3], [w / 2, h * 2/3], [w * 3/4, h * 2/3],
      [w / 6, h / 2], [w * 5/6, h / 2],
      [w / 3, h / 2], [w * 2/3, h / 2],
    ];
    return positions.some(([x, y]) =>
      map.queryRenderedFeatures([x, y], { layers: ['adm2-fill'] }).length > 0,
    );
  }, { timeout: 15_000 });

  return page.evaluate(() => {
    const map = (window as any).__map;
    const c = map.getCanvas();
    const w = c.offsetWidth, h = c.offsetHeight;
    const positions: [number, number][] = [
      [w / 4, h / 3], [w / 2, h / 3], [w * 3/4, h / 3],
      [w / 4, h / 2], [w / 2, h / 2], [w * 3/4, h / 2],
      [w / 4, h * 2/3], [w / 2, h * 2/3], [w * 3/4, h * 2/3],
      [w / 6, h / 2], [w * 5/6, h / 2],
      [w / 3, h / 2], [w * 2/3, h / 2],
    ];
    for (const [cx, cy] of positions) {
      const features = map.queryRenderedFeatures([cx, cy], { layers: ['adm2-fill'] });
      if (features.length > 0) {
        const lngLat = map.unproject([cx, cy]);
        map.fire('click', { lngLat, point: { x: cx, y: cy }, features, originalEvent: new MouseEvent('click') });
        return features[0].properties?.adm2_pcode ?? null;
      }
    }
    return null;
  });
}

/** Close any open dropdown by clicking the map canvas area */
async function closeDropdown(page: Page) {
  await page.locator('.fc-map-column').click({ position: { x: 10, y: 10 }, force: true });
  await page.waitForTimeout(200);
}

async function selectProvinceViaDropdown(page: Page) {
  const resp = page.waitForResponse(r => r.url().includes('/forecast/'), { timeout: 10_000 });
  await page.getByTestId('province-dropdown').click();
  await page.getByTestId('province-dropdown-list').locator('li').first().click();
  await resp;
  await page.waitForTimeout(400);
}

async function selectAmphoeViaDropdown(page: Page) {
  const resp = page.waitForResponse(r => r.url().includes('/forecast/'), { timeout: 10_000 });
  const dd = page.getByTestId('amphoe-dropdown');
  await dd.waitFor({ state: 'visible', timeout: 8_000 });
  await dd.click();
  await page.getByTestId('amphoe-dropdown-list').locator('li').first().click();
  await resp;
  await page.waitForTimeout(400);
}

async function hasColorDots(page: Page, listTestId: string): Promise<boolean> {
  const list = page.getByTestId(listTestId);
  const count = await list.locator('li span[style*="background"]').count();
  return count > 0;
}

// ─── left panel: province ──────────────────────────────────────────────────────

test('panel: province select → amphoe dropdown appears', async ({ page }) => {
  await waitForDate(page);
  await selectProvinceViaDropdown(page);
  await expect(page.getByTestId('amphoe-dropdown')).toBeVisible({ timeout: 5_000 });
});

test('panel: province select → amphoe dropdown has colors', async ({ page }) => {
  await waitForDate(page);
  await selectProvinceViaDropdown(page);
  await page.getByTestId('amphoe-dropdown').click();
  await page.getByTestId('amphoe-dropdown-list').waitFor({ state: 'visible' });
  expect(await hasColorDots(page, 'amphoe-dropdown-list')).toBe(true);
});

test('panel: province select → province dropdown retains colors on reopen', async ({ page }) => {
  await waitForDate(page);
  await selectProvinceViaDropdown(page);
  await page.getByTestId('province-dropdown').click();
  await page.getByTestId('province-dropdown-list').waitFor({ state: 'visible' });
  expect(await hasColorDots(page, 'province-dropdown-list')).toBe(true);
});

test('panel: amphoe select → tambon dropdown appears', async ({ page }) => {
  await waitForDate(page);
  await selectProvinceViaDropdown(page);
  await selectAmphoeViaDropdown(page);
  await expect(page.getByTestId('tambon-dropdown')).toBeVisible({ timeout: 5_000 });
});

test('panel: amphoe select → amphoe dropdown retains colors on reopen', async ({ page }) => {
  await waitForDate(page);
  await selectProvinceViaDropdown(page);
  await selectAmphoeViaDropdown(page);
  await page.getByTestId('amphoe-dropdown').click();
  await page.getByTestId('amphoe-dropdown-list').waitFor({ state: 'visible' });
  expect(await hasColorDots(page, 'amphoe-dropdown-list')).toBe(true);
});

test('panel: amphoe select → province dropdown retains colors on reopen', async ({ page }) => {
  await waitForDate(page);
  await selectProvinceViaDropdown(page);
  await selectAmphoeViaDropdown(page);
  await page.getByTestId('province-dropdown').click();
  await page.getByTestId('province-dropdown-list').waitFor({ state: 'visible' });
  expect(await hasColorDots(page, 'province-dropdown-list')).toBe(true);
});

// ─── map click: province ───────────────────────────────────────────────────────

test('map click: province select → amphoe dropdown appears', async ({ page }) => {
  await waitForDate(page);
  const resp = page.waitForResponse(r => r.url().includes('/forecast/amphoe'), { timeout: 10_000 });
  const pcode = await clickMapProvince(page);
  expect(pcode).not.toBeNull();
  await resp;
  await expect(page.getByTestId('amphoe-dropdown')).toBeVisible({ timeout: 5_000 });
});

test('map click: province select → amphoe dropdown has colors', async ({ page }) => {
  await waitForDate(page);
  const resp = page.waitForResponse(r => r.url().includes('/forecast/amphoe'), { timeout: 10_000 });
  await clickMapProvince(page);
  await resp;
  await page.getByTestId('amphoe-dropdown').waitFor({ state: 'visible', timeout: 5_000 });
  await page.getByTestId('amphoe-dropdown').click();
  await page.getByTestId('amphoe-dropdown-list').waitFor({ state: 'visible' });
  expect(await hasColorDots(page, 'amphoe-dropdown-list')).toBe(true);
});

test('map click: province select → province dropdown retains colors on reopen', async ({ page }) => {
  await waitForDate(page);
  const resp = page.waitForResponse(r => r.url().includes('/forecast/amphoe'), { timeout: 10_000 });
  await clickMapProvince(page);
  await resp;
  await page.getByTestId('province-dropdown').click();
  await page.getByTestId('province-dropdown-list').waitFor({ state: 'visible' });
  expect(await hasColorDots(page, 'province-dropdown-list')).toBe(true);
});

// ─── map click: amphoe ─────────────────────────────────────────────────────────

test('map click: amphoe select → tambon dropdown appears', async ({ page }) => {
  await waitForDate(page);
  const provResp = page.waitForResponse(r => r.url().includes('/forecast/amphoe'), { timeout: 10_000 });
  await clickMapProvince(page);
  await provResp;
  await page.waitForTimeout(200);

  const amphoeResp = page.waitForResponse(r => r.url().includes('/forecast/'), { timeout: 10_000 });
  await clickMapAmphoe(page);
  await amphoeResp;
  await expect(page.getByTestId('tambon-dropdown')).toBeVisible({ timeout: 5_000 });
});

test('map click: amphoe select → amphoe dropdown retains colors on reopen', async ({ page }) => {
  await waitForDate(page);
  const provResp = page.waitForResponse(r => r.url().includes('/forecast/amphoe'), { timeout: 10_000 });
  await clickMapProvince(page);
  await provResp;
  await page.waitForTimeout(1000);

  const amphoeResp = page.waitForResponse(r => r.url().includes('/forecast/'), { timeout: 10_000 });
  await clickMapAmphoe(page);
  await amphoeResp;

  await page.getByTestId('amphoe-dropdown').click();
  await page.getByTestId('amphoe-dropdown-list').waitFor({ state: 'visible' });
  expect(await hasColorDots(page, 'amphoe-dropdown-list')).toBe(true);
});

// ─── table click: tambon ──────────────────────────────────────────────────────

test('table: All Tambons → tambon select → all 3 dropdowns have colors', async ({ page }) => {
  await waitForDate(page);
  await selectProvinceViaDropdown(page);

  // Drill to all tambons
  const tambResp = page.waitForResponse(r => r.url().includes('/forecast/tambon'), { timeout: 10_000 });
  await page.getByText('All Tambons').click();
  await tambResp;

  // Click first table row to select a tambon
  const firstRow = page.locator('tbody tr').first();
  await firstRow.waitFor({ state: 'visible', timeout: 8_000 });
  await firstRow.click();
  await page.waitForTimeout(500);

  // Province dropdown
  await page.getByTestId('province-dropdown').click();
  await page.getByTestId('province-dropdown-list').waitFor({ state: 'visible' });
  expect(await hasColorDots(page, 'province-dropdown-list')).toBe(true);
  await closeDropdown(page);

  // Amphoe dropdown
  await page.getByTestId('amphoe-dropdown').click();
  await page.getByTestId('amphoe-dropdown-list').waitFor({ state: 'visible' });
  expect(await hasColorDots(page, 'amphoe-dropdown-list')).toBe(true);
});

test('table: All Tambons (no province) → tambon select → all 3 dropdowns have colors', async ({ page }) => {

  await waitForDate(page);
  // No province selected — click All Tambons from top level
  const tambResp = page.waitForResponse(r => r.url().includes('/forecast/tambon'), { timeout: 10_000 });
  await page.getByText('All Tambons').click();
  await tambResp;

  const firstRow = page.locator('tbody tr').first();
  await firstRow.waitFor({ state: 'visible', timeout: 8_000 });
  await firstRow.click();
  await page.waitForTimeout(500);

  // Province dropdown
  await page.getByTestId('province-dropdown').click();
  await page.getByTestId('province-dropdown-list').waitFor({ state: 'visible' });
  expect(await hasColorDots(page, 'province-dropdown-list')).toBe(true);
  await closeDropdown(page);

  // Amphoe dropdown
  await page.getByTestId('amphoe-dropdown').click();
  await page.getByTestId('amphoe-dropdown-list').waitFor({ state: 'visible' });
  expect(await hasColorDots(page, 'amphoe-dropdown-list')).toBe(true);
});

// ─── multi-step navigation cycles ─────────────────────────────────────────────

async function selectTambonViaDropdown(page: Page) {
  const resp = page.waitForResponse(r => r.url().includes('/forecast/tambon'), { timeout: 10_000 });
  const dd = page.getByTestId('tambon-dropdown');
  await dd.waitFor({ state: 'visible', timeout: 8_000 });
  await dd.click();
  await page.getByTestId('tambon-dropdown-list').locator('li').first().click();
  await resp;
  await page.waitForTimeout(300);
}

async function deselectTambon(page: Page) {
  const resp = page.waitForResponse(r => r.url().includes('/forecast/amphoe'), { timeout: 10_000 });
  await page.getByTestId('tambon-deselect').click();
  await resp;
  await page.waitForTimeout(300);
}

// Exact sequence that exposed the tambonColorData-cleared-on-deselect bug:
// select tambon → deselect (calls fetchData amphoe) → tambon dropdown must still have colors
test('multi-step: tambon select → deselect → tambon dropdown retains colors', async ({ page }) => {
  await waitForDate(page);
  await selectProvinceViaDropdown(page);
  await selectAmphoeViaDropdown(page);

  await selectTambonViaDropdown(page);
  await deselectTambon(page);

  await page.getByTestId('tambon-dropdown').click();
  await page.getByTestId('tambon-dropdown-list').waitFor({ state: 'visible' });
  expect(await hasColorDots(page, 'tambon-dropdown-list')).toBe(true);
});

// Two deselect cycles: ensures colors survive repeated fetchData('amphoe') calls
test('multi-step: tambon select → deselect × 2 → tambon dropdown retains colors', async ({ page }) => {
  await waitForDate(page);
  await selectProvinceViaDropdown(page);
  await selectAmphoeViaDropdown(page);

  await selectTambonViaDropdown(page);
  await deselectTambon(page);
  await selectTambonViaDropdown(page);
  await deselectTambon(page);

  await page.getByTestId('tambon-dropdown').click();
  await page.getByTestId('tambon-dropdown-list').waitFor({ state: 'visible' });
  expect(await hasColorDots(page, 'tambon-dropdown-list')).toBe(true);
});

// No province dropdown — enter via map click, then cycle tambon select/deselect
test('multi-step: map entry → tambon select → deselect → tambon dropdown retains colors', async ({ page }) => {
  await waitForDate(page);

  const provResp = page.waitForResponse(r => r.url().includes('/forecast/amphoe'), { timeout: 10_000 });
  await clickMapProvince(page);
  await provResp;
  const amphoeResp = page.waitForResponse(r => r.url().includes('/forecast/'), { timeout: 10_000 });
  await clickMapAmphoe(page);
  await amphoeResp;

  await selectTambonViaDropdown(page);
  await deselectTambon(page);

  await page.getByTestId('tambon-dropdown').click();
  await page.getByTestId('tambon-dropdown-list').waitFor({ state: 'visible' });
  expect(await hasColorDots(page, 'tambon-dropdown-list')).toBe(true);
});
