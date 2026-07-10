import { test, expect } from '@playwright/test';
import { waitForMap, getPaint, getLayout, waitForLayout } from './helpers';

const PAGE = '/forecast/yom';

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => localStorage.setItem('lang', 'en'));
  await page.goto(PAGE);
  await waitForMap(page);
});

// ─── Helpers ──────────────────────────────────────────────────────────────────

/** Switch view mode via the sidebar dropdown */
async function setViewMode(page: import('@playwright/test').Page, value: 'admin' | 'basin') {
  await page.getByTestId('viewmode-dropdown').click();
  await page.getByTestId(`viewmode-dropdown-option-${value}`).click();
  await page.waitForTimeout(600);
}

/** Pick a date from the top-bar date dropdown (waits for options to load).
 *  index=0 is the newest date (DESC). Use index=1 to pick a date different from
 *  the auto-selected newest so tests verify an actual state change.
 */
async function pickDate(page: import('@playwright/test').Page, index = 1) {
  // Wait until the date dropdown has options (dates loaded from API)
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
  const responsePromise = page.waitForResponse(
    r => r.url().includes('/basin/') || r.url().includes('/forecast/'),
    { timeout: 10_000 },
  );
  await options.nth(index).click();
  await responsePromise;
  await page.waitForTimeout(600);
}

/** Return the fill-opacity of whichever active fill layer is currently painted */
async function activeFillOpacity(page: import('@playwright/test').Page) {
  return page.evaluate(() => {
    const map = (window as any).__map;
    for (const id of ['yom-l1-fill', 'adm1-fill', 'basin-watershed-fill']) {
      const op = map?.getPaintProperty(id, 'fill-opacity');
      if (typeof op === 'number' && op > 0) return op;
    }
    return 0;
  });
}

/** Open the overlay panel and toggle a layer by label */
async function toggleOverlay(page: import('@playwright/test').Page, label: string | RegExp) {
  const open = await page.locator('text=Layers').isVisible().catch(() => false);
  if (!open) await page.locator('[title="Toggle overlays"]').click();
  await page.getByRole('button', { name: label }).click();
}

// ─── Tests ────────────────────────────────────────────────────────────────────

test('map loads and exposes __map', async ({ page }) => {
  expect(await page.evaluate(() => !!(window as any).__map)).toBe(true);
});

test('basin mode: yom-l1-fill layer is present', async ({ page }) => {
  const opacity = await getPaint(page, 'yom-l1-fill', 'fill-opacity');
  expect(typeof opacity).toBe('number');
});

test('basin mode: selecting a date paints yom-l1-fill', async ({ page }) => {
  await pickDate(page, 0);
  expect(Number(await getPaint(page, 'yom-l1-fill', 'fill-opacity'))).toBeGreaterThan(0);
});

test('switch to admin: adm1-fill visible, yom-l1-fill hidden', async ({ page }) => {
  await setViewMode(page, 'admin');
  expect(Number(await getPaint(page, 'adm1-fill', 'fill-opacity'))).toBeGreaterThan(0);
  expect(await getLayout(page, 'yom-l1-fill', 'visibility')).toBe('none');
});

test('switch back to basin: yom-l1-fill visible again', async ({ page }) => {
  await setViewMode(page, 'admin');
  await setViewMode(page, 'basin');
  expect(await getLayout(page, 'yom-l1-fill', 'visibility')).toBe('visible');
});

test('admin mode: selecting a date paints adm1-fill', async ({ page }) => {
  await setViewMode(page, 'admin');
  await pickDate(page, 0);
  expect(Number(await getPaint(page, 'adm1-fill', 'fill-opacity'))).toBeGreaterThan(0);
});

test('date label is preserved when switching mode', async ({ page }) => {
  await pickDate(page, 0);
  const labelBefore = await page.getByTestId('date-dropdown').textContent();
  await setViewMode(page, 'admin');
  await page.waitForTimeout(800);
  const labelAfter = await page.getByTestId('date-dropdown').textContent();
  expect(labelAfter).toBe(labelBefore);
});

// ─── Overlay toggles ──────────────────────────────────────────────────────────

test('rivers overlay: toggles yom-rivers visibility', async ({ page }) => {
  expect(await getLayout(page, 'yom-rivers', 'visibility')).toBe('none');
  await toggleOverlay(page, /rivers/i);
  await waitForLayout(page, 'yom-rivers', 'visibility', 'visible');
  await toggleOverlay(page, /rivers/i);
  await waitForLayout(page, 'yom-rivers', 'visibility', 'none');
});

test('hillshade overlay: toggles hillshading visibility', async ({ page }) => {
  expect(await getLayout(page, 'hillshading', 'visibility')).toBe('none');
  await toggleOverlay(page, /hills/i);
  await waitForLayout(page, 'hillshading', 'visibility', 'visible');
  await toggleOverlay(page, /hills/i);
  await waitForLayout(page, 'hillshading', 'visibility', 'none');
});

test('background overlay: toggles basemap-cover visibility', async ({ page }) => {
  expect(await getLayout(page, 'basemap-cover', 'visibility')).toBe('none');
  await toggleOverlay(page, /background/i);
  await waitForLayout(page, 'basemap-cover', 'visibility', 'visible');
  await toggleOverlay(page, /background/i);
  await waitForLayout(page, 'basemap-cover', 'visibility', 'none');
});

// ─── Fill opacity with detail overlays ───────────────────────────────────────

test('fill opacity reduces to 0.3 when rivers overlay is ON', async ({ page }) => {
  await pickDate(page, 0);
  expect(Number(await activeFillOpacity(page))).toBeCloseTo(0.8, 1);
  await toggleOverlay(page, /rivers/i);
  await page.waitForTimeout(300);
  expect(Number(await activeFillOpacity(page))).toBeCloseTo(0.3, 1);
});

test('fill opacity restores to 0.8 when rivers overlay is OFF', async ({ page }) => {
  await pickDate(page, 0);
  await toggleOverlay(page, /rivers/i);
  await page.waitForTimeout(300);
  await toggleOverlay(page, /rivers/i);
  await page.waitForTimeout(300);
  expect(Number(await activeFillOpacity(page))).toBeCloseTo(0.8, 1);
});

test('fill opacity reduces to 0.3 when hillshade overlay is ON', async ({ page }) => {
  await pickDate(page, 0);
  await toggleOverlay(page, /hills/i);
  await page.waitForTimeout(300);
  expect(Number(await activeFillOpacity(page))).toBeCloseTo(0.3, 1);
});

test('fill opacity reduces when both rivers and hillshade are ON', async ({ page }) => {
  await pickDate(page, 0);
  await toggleOverlay(page, /rivers/i);
  await toggleOverlay(page, /hills/i);
  await page.waitForTimeout(300);
  expect(Number(await activeFillOpacity(page))).toBeCloseTo(0.3, 1);
});

test('fill opacity persists after mode switch with rivers ON', async ({ page }) => {
  await pickDate(page, 0);
  await toggleOverlay(page, /rivers/i);
  await page.waitForTimeout(300);
  await setViewMode(page, 'admin');
  await page.waitForTimeout(600);
  expect(Number(await activeFillOpacity(page))).toBeCloseTo(0.3, 1);
});

// ─── Admin map: province select / deselect with overlay active ────────────────

/** Select the first province via the province dropdown */
async function selectFirstProvince(page: import('@playwright/test').Page) {
  await page.getByTestId('province-dropdown').click();
  const list = page.getByTestId('province-dropdown-list');
  await list.waitFor({ state: 'visible', timeout: 8_000 });
  const responsePromise = page.waitForResponse(
    r => r.url().includes('/forecast/'),
    { timeout: 10_000 },
  );
  await list.locator('li').first().click();
  await responsePromise;
  await page.waitForTimeout(500);
}

/** Click the × deselect button for the currently selected province */
async function deselectProvince(page: import('@playwright/test').Page) {
  await page.getByTestId('province-deselect').click();
  await page.waitForTimeout(500);
}

test('admin: select province keeps fill opacity at 0.3 when rivers ON', async ({ page }) => {
  await setViewMode(page, 'admin');
  await pickDate(page, 0);
  await toggleOverlay(page, /rivers/i);
  await page.waitForTimeout(300);

  await selectFirstProvince(page);

  // province click drills to amphoe — adm2-fill is the active layer, must stay reduced
  const opacity = await page.evaluate(() => {
    const map = (window as any).__map;
    return map?.getPaintProperty('adm2-fill', 'fill-opacity') ?? 0;
  });
  expect(Number(opacity)).toBeCloseTo(0.3, 1);
});

test('admin: deselect province keeps fill opacity at 0.3 when rivers ON', async ({ page }) => {
  await setViewMode(page, 'admin');
  await pickDate(page, 0);
  await toggleOverlay(page, /rivers/i);
  await page.waitForTimeout(300);

  await selectFirstProvince(page);
  await deselectProvince(page);
  await page.waitForTimeout(800); // wait for fetchData to repaint

  // adm1-fill should be repainted at reduced opacity, not hardcoded 0.5
  const opacity = await page.evaluate(() => {
    const map = (window as any).__map;
    return map?.getPaintProperty('adm1-fill', 'fill-opacity') ?? 0;
  });
  expect(Number(opacity)).toBeCloseTo(0.3, 1);
});

test('admin: deselect province uses normal opacity when no overlay active', async ({ page }) => {
  await setViewMode(page, 'admin');
  await pickDate(page, 0);
  await selectFirstProvince(page);
  await deselectProvince(page);
  await page.waitForTimeout(800);

  const opacity = await page.evaluate(() => {
    const map = (window as any).__map;
    return map?.getPaintProperty('adm1-fill', 'fill-opacity') ?? 0;
  });
  expect(Number(opacity)).toBeCloseTo(0.8, 1);
});

// ─── Admin map: dismiss amphoe then toggle overlay ────────────────────────────

/** Select the first amphoe via the amphoe dropdown */
async function selectFirstAmphoe(page: import('@playwright/test').Page) {
  const dropdown = page.getByTestId('amphoe-dropdown');
  await dropdown.waitFor({ state: 'visible', timeout: 8_000 });
  await dropdown.click();
  const list = page.getByTestId('amphoe-dropdown-list');
  await list.waitFor({ state: 'visible', timeout: 8_000 });
  const responsePromise = page.waitForResponse(
    r => r.url().includes('/forecast/'),
    { timeout: 10_000 },
  );
  await list.locator('li').first().click();
  await responsePromise;
  await page.waitForTimeout(500);
}

test('admin: adm2-fill stays 0 after dismiss-amphoe then toggle hill', async ({ page }) => {
  // Prove the bug: setDataFillOpacity must not resurrect inactive fill layers
  await setViewMode(page, 'admin');
  await pickDate(page, 0);
  await selectFirstProvince(page);
  await selectFirstAmphoe(page);   // adm2-fill gets painted
  await deselectProvince(page);    // back to province level — adm2-fill should be 0
  await page.waitForTimeout(800);

  await toggleOverlay(page, /hills/i); // triggers setDataFillOpacity
  await page.waitForTimeout(300);

  const adm2Opacity = await getPaint(page, 'adm2-fill', 'fill-opacity');
  expect(Number(adm2Opacity)).toBe(0); // must stay 0, not become 0.3
});

test('admin: adm1-fill still reduced after dismiss-amphoe then toggle hill', async ({ page }) => {
  await setViewMode(page, 'admin');
  await pickDate(page, 0);
  await selectFirstProvince(page);
  await selectFirstAmphoe(page);
  await deselectProvince(page);
  await page.waitForTimeout(800);

  await toggleOverlay(page, /hills/i);
  await page.waitForTimeout(300);

  const adm1Opacity = await getPaint(page, 'adm1-fill', 'fill-opacity');
  expect(Number(adm1Opacity)).toBeCloseTo(0.3, 1);
});

// ─── All Tambons button ───────────────────────────────────────────────────────

test('all tambon: adm3-line becomes visible', async ({ page }) => {
  await setViewMode(page, 'admin');
  await page.getByText('All Tambons').click();
  await page.waitForTimeout(500);
  expect(await getLayout(page, 'adm3-line', 'visibility')).toBe('visible');
});

test('all tambon: filter must not use adm1_pcode (field absent in tambon PMTiles)', async ({ page }) => {
  await setViewMode(page, 'admin');
  await selectFirstProvince(page);
  await page.getByText('All Tambons').click();
  await page.waitForTimeout(500);

  const filter = await page.evaluate(() =>
    JSON.stringify((window as any).__map?.getFilter('adm3-line'))
  );
  expect(filter).not.toContain('adm1_pcode');
});

test('all tambon after province: filter uses adm2_pcode prefix', async ({ page }) => {
  await setViewMode(page, 'admin');
  await selectFirstProvince(page);
  await page.getByText('All Tambons').click();
  await page.waitForTimeout(500);

  const filter = await page.evaluate(() =>
    JSON.stringify((window as any).__map?.getFilter('adm3-line'))
  );
  expect(filter).toContain('adm2_pcode');
});

// ─── All Tambons → select tambon: left panel correctness ─────────────────────

async function clickAllTambons(page: import('@playwright/test').Page) {
  const resp = page.waitForResponse(
    r => r.url().includes('/forecast/tambon'),
    { timeout: 10_000 },
  );
  await page.getByText('All Tambons').click();
  await resp;
  await page.waitForTimeout(500);
}

test('all tambon → select tambon: left panel shows 3 deselect buttons', async ({ page }) => {
  await setViewMode(page, 'admin');
  await pickDate(page, 0);
  await selectFirstProvince(page);
  await clickAllTambons(page);

  const firstRow = page.locator('tbody tr').first();
  await firstRow.waitFor({ state: 'visible', timeout: 8_000 });
  await firstRow.click();
  await page.waitForTimeout(500);

  // province × + amphoe × + tambon × must all appear
  await expect(page.locator('.fc-sidebar button', { hasText: '×' })).toHaveCount(3);
});

test('all tambon → select tambon: tambon section list is populated (not stale/wrong amphoe)', async ({ page }) => {
  await setViewMode(page, 'admin');
  await pickDate(page, 0);
  await selectFirstProvince(page);
  await clickAllTambons(page);

  const firstRow = page.locator('tbody tr').first();
  await firstRow.waitFor({ state: 'visible', timeout: 8_000 });
  await firstRow.click();
  await page.waitForTimeout(500);

  // tambon-deselect button visible means the tambon is selected in the sidebar
  await expect(page.getByTestId('tambon-deselect')).toBeVisible({ timeout: 3_000 });
});

test('all tambon (no province) → select tambon: province and amphoe are identified in left panel', async ({ page }) => {
  await setViewMode(page, 'admin');
  await pickDate(page, 0);
  // no province selected — click All Tambons from top level
  await clickAllTambons(page);

  const firstRow = page.locator('tbody tr').first();
  await firstRow.waitFor({ state: 'visible', timeout: 8_000 });
  await firstRow.click();
  await page.waitForTimeout(500);

  // province + amphoe + tambon must all be identified → 3 × buttons
  await expect(page.locator('.fc-sidebar button', { hasText: '×' })).toHaveCount(3);
});

// ─── All Amphoes button ────────────────────────────────────────────────────────

test('all amphoe: adm2-line becomes visible', async ({ page }) => {
  await setViewMode(page, 'admin');
  await page.getByTestId('all-amphoes-btn').click();
  await page.waitForTimeout(500);
  expect(await getLayout(page, 'adm2-line', 'visibility')).toBe('visible');
});

test('all amphoe: filter is not scoped to a province (all basin amphoes)', async ({ page }) => {
  await setViewMode(page, 'admin');
  await page.getByTestId('all-amphoes-btn').click();
  await page.waitForTimeout(500);

  // MapLibre's getFilter() returns undefined (not the literal null) once a filter is cleared
  // via setFilter(id, null) — the same convention the existing "all tambon" flow relies on.
  const filter = await page.evaluate(() =>
    String((window as any).__map?.getFilter('adm2-line'))
  );
  expect(filter).not.toContain('adm1_pcode');
});

test('all amphoe after province select: filter resets to unscoped (no longer limited to that province)', async ({ page }) => {
  await setViewMode(page, 'admin');
  await selectFirstProvince(page);
  await page.getByTestId('all-amphoes-btn').click();
  await page.waitForTimeout(500);

  const filter = await page.evaluate(() =>
    String((window as any).__map?.getFilter('adm2-line'))
  );
  expect(filter).not.toContain('adm1_pcode');
});

async function clickAllAmphoes(page: import('@playwright/test').Page) {
  const resp = page.waitForResponse(
    r => r.url().includes('/forecast/amphoe'),
    { timeout: 10_000 },
  );
  await page.getByTestId('all-amphoes-btn').click();
  await resp;
  await page.waitForTimeout(500);
}

test('all amphoe → select amphoe (table row): left panel shows 2 deselect buttons (province + amphoe)', async ({ page }) => {
  await setViewMode(page, 'admin');
  await pickDate(page, 0);
  await clickAllAmphoes(page);

  const firstRow = page.locator('tbody tr').first();
  await firstRow.waitFor({ state: 'visible', timeout: 8_000 });
  await firstRow.click();
  await page.waitForTimeout(500);

  await expect(page.locator('.fc-sidebar button', { hasText: '×' })).toHaveCount(2);
});

test('all amphoe → select amphoe: derived province is identified (province-deselect visible)', async ({ page }) => {
  await setViewMode(page, 'admin');
  await pickDate(page, 0);
  await clickAllAmphoes(page);

  const firstRow = page.locator('tbody tr').first();
  await firstRow.waitFor({ state: 'visible', timeout: 8_000 });
  await firstRow.click();
  await page.waitForTimeout(500);

  await expect(page.getByTestId('province-deselect')).toBeVisible({ timeout: 3_000 });
  await expect(page.getByTestId('amphoe-deselect')).toBeVisible({ timeout: 3_000 });
});

test('all amphoe → select amphoe → deselect: returns to all-amphoe view', async ({ page }) => {
  await setViewMode(page, 'admin');
  await pickDate(page, 0);
  await clickAllAmphoes(page);

  const firstRow = page.locator('tbody tr').first();
  await firstRow.waitFor({ state: 'visible', timeout: 8_000 });
  await firstRow.click();
  await page.waitForTimeout(500);

  await page.getByTestId('amphoe-deselect').click();
  await page.waitForTimeout(500);

  // Back to the unfiltered all-amphoe view: province deselect button gone, filter null again
  await expect(page.locator('.fc-sidebar button', { hasText: '×' })).toHaveCount(0);
  const filter = await page.evaluate(() =>
    String((window as any).__map?.getFilter('adm2-line'))
  );
  expect(filter).not.toContain('adm1_pcode');
});

test('all amphoe → select amphoe: first selection does not drill (adm3-fill stays hidden)', async ({ page }) => {
  await setViewMode(page, 'admin');
  await pickDate(page, 0);
  await clickAllAmphoes(page);

  const firstRow = page.locator('tbody tr').first();
  await firstRow.waitFor({ state: 'visible', timeout: 8_000 });
  await firstRow.click();
  await page.waitForTimeout(800);

  // First click selects only — the tambon layer must not appear yet
  expect(await getLayout(page, 'adm3-fill', 'visibility')).toBe('none');
});

test('all amphoe → select amphoe → re-click on map drills to its tambons', async ({ page }) => {
  await setViewMode(page, 'admin');
  await pickDate(page, 0);
  await clickAllAmphoes(page);

  const firstRow = page.locator('tbody tr').first();
  await firstRow.waitFor({ state: 'visible', timeout: 8_000 });
  await firstRow.click();
  await page.waitForTimeout(1200); // let fitBounds settle
  expect(await getLayout(page, 'adm3-fill', 'visibility')).toBe('none');

  // Find a screen point that is actually inside the selected amphoe's rendered fill
  // (its pcode is on the adm2-highlight filter), then click there to re-select → drill.
  const pt = await page.evaluate(() => {
    const map = (window as any).__map;
    const hl = map.getFilter('adm2-highlight');
    const pcode = Array.isArray(hl) ? hl[2] : null;
    if (!pcode) return null;
    const c = map.getContainer().getBoundingClientRect();
    for (let gy = 0.25; gy <= 0.75; gy += 0.05) {
      for (let gx = 0.25; gx <= 0.75; gx += 0.05) {
        const p = { x: c.width * gx, y: c.height * gy };
        const feats = map.queryRenderedFeatures(p, { layers: ['adm2-fill'] });
        if (feats.some((f: any) => f.properties?.adm2_pcode === pcode)) {
          return { x: c.left + p.x, y: c.top + p.y };
        }
      }
    }
    return null;
  });
  expect(pt).not.toBeNull();
  await page.mouse.click(pt!.x, pt!.y);
  await page.waitForTimeout(1000);

  expect(await getLayout(page, 'adm3-fill', 'visibility')).toBe('visible');
});

test('all-amphoes-btn is absent in basin mode', async ({ page }) => {
  await expect(page.getByTestId('all-amphoes-btn')).toHaveCount(0);
});

test('admin: toggling rivers OFF after province select restores full opacity', async ({ page }) => {
  await setViewMode(page, 'admin');
  await pickDate(page, 0);
  await toggleOverlay(page, /rivers/i);
  await selectFirstProvince(page);

  await toggleOverlay(page, /rivers/i);
  await page.waitForTimeout(400);

  // Province click drills to amphoe — adm2-fill is the active layer
  const opacity = await getPaint(page, 'adm2-fill', 'fill-opacity');
  expect(Number(opacity)).toBeCloseTo(0.8, 1);
});
