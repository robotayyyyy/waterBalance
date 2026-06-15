import { test, expect } from '@playwright/test';
import { waitForMap } from './helpers';

const TODAY = new Date().toISOString().slice(0, 10); // e.g. "2026-06-14"
const CURRENT_MONTH_PREFIX = TODAY.slice(0, 7);       // e.g. "2026-06"
const CURRENT_MONTH_DATE = CURRENT_MONTH_PREFIX + '-01';
const CURRENT_YEAR = TODAY.slice(0, 4);               // e.g. "2026"

// A date clearly in the future — should never be auto-selected as default
const FAR_FUTURE = '2030-01-01';

const API = 'http://localhost:3001';

/** Wait until the date-dropdown shows a non-empty label */
async function waitForDateDropdown(page: import('@playwright/test').Page) {
  await page.waitForFunction(
    () => {
      const el = document.querySelector('[data-testid="date-dropdown"]');
      return el && el.textContent?.trim() !== '—' && el.textContent?.trim() !== '';
    },
    { timeout: 15_000 },
  );
}

test.describe('Default date selection', () => {
  test('6months model selects current month, not latest future date', async ({ page }) => {
    const dates = ['2026-04-01', '2026-05-01', CURRENT_MONTH_DATE, '2026-07-01', FAR_FUTURE];

    await page.route(`${API}/basin/dates*`, route => route.fulfill({ json: dates }));
    await page.addInitScript(() => localStorage.setItem('lang', 'en'));
    await page.goto('/forecast/yom');
    await waitForMap(page);
    await waitForDateDropdown(page);

    const label = await page.getByTestId('date-dropdown').textContent();
    // 6months fmtMonth = "June 2026" — should show current year, not far future
    expect(label).toContain(CURRENT_YEAR);
    expect(label).not.toContain('2030');
  });

  test('7days model selects today, not latest future date', async ({ page }) => {
    const sixMonthDates = ['2026-04-01', '2026-05-01', CURRENT_MONTH_DATE, FAR_FUTURE];
    const sevenDayDates = ['2026-06-12', '2026-06-13', TODAY, '2026-06-15', FAR_FUTURE];

    await page.route(`${API}/basin/dates*`, route => {
      const url = route.request().url();
      route.fulfill({ json: url.includes('model=7days') ? sevenDayDates : sixMonthDates });
    });

    await page.addInitScript(() => localStorage.setItem('lang', 'en'));
    await page.goto('/forecast/yom');
    await waitForMap(page);
    await waitForDateDropdown(page);

    // Switch to 7days via the model dropdown
    await page.getByTestId('model-dropdown').click();
    await page.getByTestId('model-dropdown-option-7days').click();
    await waitForDateDropdown(page);

    const label = await page.getByTestId('date-dropdown').textContent();
    // 7days fmtDay = "14 Jun 2026" or similar — should contain today's year, not 2030
    expect(label).toContain(CURRENT_YEAR);
    expect(label).not.toContain('2030');
  });

  test('6months falls back to latest when current month absent', async ({ page }) => {
    const dates = ['2026-04-01', '2026-05-01', FAR_FUTURE];

    await page.route(`${API}/basin/dates*`, route => route.fulfill({ json: dates }));
    await page.addInitScript(() => localStorage.setItem('lang', 'en'));
    await page.goto('/forecast/yom');
    await waitForMap(page);
    await waitForDateDropdown(page);

    const label = await page.getByTestId('date-dropdown').textContent();
    expect(label).toContain('2030');
  });

  test('7days falls back to latest when today absent', async ({ page }) => {
    const sixMonthDates = ['2026-04-01', '2026-05-01', CURRENT_MONTH_DATE, FAR_FUTURE];
    const sevenDayDates = ['2026-06-10', '2026-06-11', '2026-06-12', FAR_FUTURE];

    await page.route(`${API}/basin/dates*`, route => {
      const url = route.request().url();
      route.fulfill({ json: url.includes('model=7days') ? sevenDayDates : sixMonthDates });
    });

    await page.addInitScript(() => localStorage.setItem('lang', 'en'));
    await page.goto('/forecast/yom');
    await waitForMap(page);
    await waitForDateDropdown(page);

    await page.getByTestId('model-dropdown').click();
    await page.getByTestId('model-dropdown-option-7days').click();
    await waitForDateDropdown(page);

    const label = await page.getByTestId('date-dropdown').textContent();
    expect(label).toContain('2030');
  });
});
