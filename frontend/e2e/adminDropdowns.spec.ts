import { test, expect } from '@playwright/test';
import { waitForMap } from './helpers';

const PAGE = '/forecast/yom';

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => localStorage.setItem('lang', 'en'));
  await page.goto(PAGE);
  await waitForMap(page);

  // Switch to admin mode
  await page.getByTestId('viewmode-dropdown').click();
  await page.getByTestId('viewmode-dropdown-option-admin').click();
  await page.waitForTimeout(500);
});

test('admin: province dropdown is visible', async ({ page }) => {
  await expect(page.getByTestId('province-dropdown')).toBeVisible();
});

test('admin: amphoe dropdown is hidden until province is selected', async ({ page }) => {
  await expect(page.getByTestId('amphoe-dropdown')).not.toBeVisible();
});

test('admin: tambon dropdown is hidden until amphoe is selected', async ({ page }) => {
  await expect(page.getByTestId('tambon-dropdown')).not.toBeVisible();
});

test('admin: selecting province reveals amphoe dropdown', async ({ page }) => {
  await page.getByTestId('province-dropdown').click();
  await page.getByTestId('province-dropdown-list').locator('li').first().click();
  await expect(page.getByTestId('amphoe-dropdown')).toBeVisible({ timeout: 5_000 });
});

test('admin: selecting amphoe reveals tambon dropdown', async ({ page }) => {
  await page.getByTestId('province-dropdown').click();
  await page.getByTestId('province-dropdown-list').locator('li').first().click();

  await page.getByTestId('amphoe-dropdown').waitFor({ state: 'visible', timeout: 5_000 });
  await page.getByTestId('amphoe-dropdown').click();
  await page.getByTestId('amphoe-dropdown-list').locator('li').first().click();

  await expect(page.getByTestId('tambon-dropdown')).toBeVisible({ timeout: 5_000 });
});

test('admin: search in province dropdown filters list', async ({ page }) => {
  await page.getByTestId('province-dropdown').click();
  const list = page.getByTestId('province-dropdown-list');
  const totalBefore = await list.locator('li').count();

  await page.getByTestId('province-search').fill('chiang');
  const totalAfter = await list.locator('li').count();

  expect(totalAfter).toBeGreaterThan(0);
  expect(totalAfter).toBeLessThan(totalBefore);
});

test('admin: amphoe dropdown retains color dots after amphoe is selected', async ({ page }) => {
  // Select province so amphoe dropdown appears with amphoe-level colors
  await page.getByTestId('province-dropdown').click();
  await page.getByTestId('province-dropdown-list').locator('li').first().click();

  // Open amphoe dropdown and confirm color dots are present
  await page.getByTestId('amphoe-dropdown').waitFor({ state: 'visible', timeout: 8_000 });
  await page.getByTestId('amphoe-dropdown').click();
  const list = page.getByTestId('amphoe-dropdown-list');
  await expect(list.locator('li span[style*="background"]').first()).toBeVisible({ timeout: 5_000 });

  // Select an amphoe — triggers tambon fetch which replaces colorData state
  const amphoeResp = page.waitForResponse(r => r.url().includes('/forecast/'), { timeout: 10_000 });
  await list.locator('li').first().click();
  await amphoeResp;
  await expect(page.getByTestId('tambon-dropdown')).toBeVisible({ timeout: 8_000 });

  // Re-open amphoe dropdown — colors must still be present from amphoeColorData
  await page.getByTestId('amphoe-dropdown').click();
  await expect(list.locator('li span[style*="background"]').first()).toBeVisible({ timeout: 3_000 });
});

test('admin: province dropdown retains color dots after province is selected', async ({ page }) => {
  // Open province dropdown and confirm color dots are present
  await page.getByTestId('province-dropdown').click();
  const list = page.getByTestId('province-dropdown-list');
  const colorDots = list.locator('li span[style*="background"]');
  await expect(colorDots.first()).toBeVisible({ timeout: 8_000 });

  // Select a province — triggers amphoe fetch which replaces colorData state
  await list.locator('li').first().click();
  await expect(page.getByTestId('amphoe-dropdown')).toBeVisible({ timeout: 8_000 });

  // Re-open province dropdown — colors must still be present from provinceColorData
  await page.getByTestId('province-dropdown').click();
  await expect(list.locator('li span[style*="background"]').first()).toBeVisible({ timeout: 3_000 });
});

test('admin: deselecting province hides amphoe and tambon dropdowns', async ({ page }) => {
  // Select a province first
  await page.getByTestId('province-dropdown').click();
  await page.getByTestId('province-dropdown-list').locator('li').first().click();
  await expect(page.getByTestId('amphoe-dropdown')).toBeVisible({ timeout: 5_000 });

  // Deselect province via the × button
  await page.getByTestId('province-deselect').click();
  await expect(page.getByTestId('amphoe-dropdown')).not.toBeVisible();
  await expect(page.getByTestId('tambon-dropdown')).not.toBeVisible();
});
