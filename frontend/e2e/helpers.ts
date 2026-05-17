import type { Page } from '@playwright/test';

export const BASE = '/forecast/yom';

/** Wait for the MapLibre map to be fully loaded and __map exposed on window */
export async function waitForMap(page: Page) {
  await page.waitForFunction(() => !!(window as any).__map, { timeout: 20_000 });
}

/** Get a MapLibre paint property from a layer */
export async function getPaint(page: Page, layerId: string, prop: string) {
  return page.evaluate(
    ({ layerId, prop }) => (window as any).__map?.getPaintProperty(layerId, prop),
    { layerId, prop },
  );
}

/** Get a MapLibre layout property from a layer */
export async function getLayout(page: Page, layerId: string, prop: string) {
  return page.evaluate(
    ({ layerId, prop }) => (window as any).__map?.getLayoutProperty(layerId, prop),
    { layerId, prop },
  );
}

/** Wait until a paint property equals the expected value (polls every 300 ms) */
export async function waitForPaint(
  page: Page, layerId: string, prop: string, expected: unknown, timeout = 8_000,
) {
  await page.waitForFunction(
    ({ layerId, prop, expected }) => (window as any).__map?.getPaintProperty(layerId, prop) === expected,
    { layerId, prop, expected },
    { timeout },
  );
}

/** Wait until a layout property equals the expected value */
export async function waitForLayout(
  page: Page, layerId: string, prop: string, expected: unknown, timeout = 8_000,
) {
  await page.waitForFunction(
    ({ layerId, prop, expected }) => (window as any).__map?.getLayoutProperty(layerId, prop) === expected,
    { layerId, prop, expected },
    { timeout },
  );
}

/** Click the view-mode toggle button ('admin' | 'basin') */
export async function switchViewMode(page: Page, mode: 'admin' | 'basin') {
  const label = mode === 'admin' ? /administration/i : /water basin/i;
  await page.getByRole('button', { name: label }).click();
}

/** Open the overlay panel and click a toggle by label */
export async function toggleOverlay(page: Page, label: string | RegExp) {
  const panel = page.locator('[title="Toggle overlays"]');
  const isOpen = await page.locator('text=Layers').isVisible().catch(() => false);
  if (!isOpen) await panel.click();
  await page.getByRole('button', { name: label }).click();
}

/** Click the first available date button in the date strip */
export async function selectFirstDate(page: Page) {
  const strip = page.locator('.fc-date-strip button, [data-testid="date-btn"]').first();
  await strip.waitFor({ state: 'visible', timeout: 12_000 });
  await strip.click();
}
