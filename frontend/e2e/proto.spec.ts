import { test, expect } from '@playwright/test';
import { waitForMap, getPaint, getLayout, waitForLayout } from './helpers';

const PAGE = '/proto/yom';

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

/** Pick a date from the top-bar date dropdown (waits for options to load) */
async function pickDate(page: import('@playwright/test').Page, index = 0) {
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

/** Select the first province in the sidebar list */
async function selectFirstProvince(page: import('@playwright/test').Page) {
  const item = page.locator('ul li').first();
  await item.waitFor({ state: 'visible', timeout: 8_000 });
  const responsePromise = page.waitForResponse(
    r => r.url().includes('/forecast/'),
    { timeout: 10_000 },
  );
  await item.click();
  await responsePromise;
  await page.waitForTimeout(500);
}

/** Click the × deselect button for the currently selected province */
async function deselectProvince(page: import('@playwright/test').Page) {
  // The × button sits inside the selected-item header of ProvinceSelector
  const xBtn = page.locator('button', { hasText: '×' }).first();
  await xBtn.waitFor({ state: 'visible', timeout: 5_000 });
  await xBtn.click();
  await page.waitForTimeout(500);
}

test('admin: select province keeps fill opacity at 0.3 when rivers ON', async ({ page }) => {
  await setViewMode(page, 'admin');
  await pickDate(page, 0);
  await toggleOverlay(page, /rivers/i);
  await page.waitForTimeout(300);

  await selectFirstProvince(page);

  // adm1-fill is repainted at province level — opacity must stay reduced
  const opacity = await page.evaluate(() => {
    const map = (window as any).__map;
    return map?.getPaintProperty('adm1-fill', 'fill-opacity') ?? 0;
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

/** Select the first amphoe from the amphoe list in the sidebar */
async function selectFirstAmphoe(page: import('@playwright/test').Page) {
  // After province select, amphoe items appear as <li> in the second list
  const items = page.locator('ul li');
  await items.nth(1).waitFor({ state: 'visible', timeout: 8_000 });
  const responsePromise = page.waitForResponse(
    r => r.url().includes('/forecast/'),
    { timeout: 10_000 },
  );
  await items.nth(1).click();
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

  // last ul in sidebar = tambon section list — the selected tambon must be highlighted
  // (fontWeight 600 on the matching li); without the fix the tambon isn't in the list
  const highlightedInTambonList = await page.evaluate(() => {
    const uls = document.querySelectorAll('.fc-sidebar ul');
    const tambonUl = uls[uls.length - 1];
    if (!tambonUl) return false;
    return Array.from(tambonUl.querySelectorAll('li')).some(li => li.style.fontWeight === '600');
  });
  expect(highlightedInTambonList).toBe(true);
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

test('admin: toggling rivers OFF after province select restores full opacity', async ({ page }) => {
  await setViewMode(page, 'admin');
  await pickDate(page, 0);
  await toggleOverlay(page, /rivers/i);
  await selectFirstProvince(page);

  await toggleOverlay(page, /rivers/i);
  await page.waitForTimeout(400);

  // Province selected → adm1-fill is the active layer
  const opacity = await getPaint(page, 'adm1-fill', 'fill-opacity');
  expect(Number(opacity)).toBeCloseTo(0.8, 1);
});
