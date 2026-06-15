import { test, expect } from '@playwright/test';
import { waitForMap } from './helpers';

const PAGE = '/forecast/yom';

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => localStorage.setItem('lang', 'en'));
  await page.goto(PAGE);
  await waitForMap(page);
  // Basin mode is default
});

test('basin: L1 dropdown is visible at default subbasin-l1 level', async ({ page }) => {
  await expect(page.getByTestId('l1-dropdown')).toBeVisible();
});

test('basin: L2 dropdown is not visible at subbasin-l1 level', async ({ page }) => {
  await expect(page.getByTestId('l2-dropdown')).not.toBeVisible();
});

test('basin: search in L1 dropdown filters list', async ({ page }) => {
  await page.getByTestId('l1-dropdown').click();
  const list = page.getByTestId('l1-dropdown-list');
  await list.waitFor({ state: 'visible' });

  const totalBefore = await list.locator('li').count();
  await page.getByTestId('l1-search').fill('08');
  const totalAfter = await list.locator('li').count();

  expect(totalAfter).toBeGreaterThan(0);
  expect(totalAfter).toBeLessThanOrEqual(totalBefore);
});

test('basin: selecting L1 shows it in the dropdown trigger', async ({ page }) => {
  await page.getByTestId('l1-dropdown').click();
  const list = page.getByTestId('l1-dropdown-list');
  await list.waitFor({ state: 'visible' });

  const firstItem = list.locator('li').first();
  const itemText = ((await firstItem.textContent()) ?? '').trim();
  await firstItem.click();

  // Dropdown closes; trigger now shows the selected item name
  await expect(page.getByTestId('l1-dropdown')).toContainText(itemText, { timeout: 3_000 });
});

test('basin: back button is visible at subbasin-l1 level', async ({ page }) => {
  await expect(page.getByTestId('basin-back-btn')).toBeVisible();
});
