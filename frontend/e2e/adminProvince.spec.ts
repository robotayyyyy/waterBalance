import { test, expect } from '@playwright/test';
import { waitForMap } from './helpers';

const PAGE = '/forecast/yom';

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => localStorage.setItem('lang', 'en'));
  await page.goto(PAGE);
  await waitForMap(page);
});

async function switchToAdmin(page: import('@playwright/test').Page) {
  await page.getByTestId('viewmode-dropdown').click();
  await page.getByTestId('viewmode-dropdown-option-admin').click();
  await page.waitForTimeout(500);
}

async function waitForDate(page: import('@playwright/test').Page) {
  await page.waitForFunction(
    () => {
      const el = document.querySelector('[data-testid="date-dropdown"]');
      return el && el.textContent?.trim() !== '—';
    },
    { timeout: 15_000 },
  );
}

test('admin: clicking province auto-drills to amphoe — API calls /forecast/amphoe', async ({ page }) => {
  await switchToAdmin(page);
  await waitForDate(page);

  await page.getByTestId('province-dropdown').click();
  const firstProvince = page.getByTestId('province-dropdown-list').locator('li').first();
  await firstProvince.waitFor({ state: 'visible', timeout: 8_000 });

  const amphoeCall = page.waitForResponse(
    r => r.url().includes('/forecast/amphoe'),
    { timeout: 10_000 },
  );

  await firstProvince.click();
  await amphoeCall;
});

test('admin: clicking province auto-drills to amphoe — table header shows Amphoe', async ({ page }) => {
  await switchToAdmin(page);
  await waitForDate(page);

  await page.getByTestId('province-dropdown').click();
  const firstProvince = page.getByTestId('province-dropdown-list').locator('li').first();
  await firstProvince.waitFor({ state: 'visible', timeout: 8_000 });

  const anyForecastCall = page.waitForResponse(
    r => r.url().includes('/forecast/'),
    { timeout: 10_000 },
  );
  await firstProvince.click();
  await anyForecastCall;

  // Table first-column header must say "Amphoe", not "Province"
  const firstTh = page.locator('table th').first();
  await expect(firstTh).toContainText('Amphoe', { timeout: 8_000 });
  await expect(firstTh).not.toContainText('Province');
});
