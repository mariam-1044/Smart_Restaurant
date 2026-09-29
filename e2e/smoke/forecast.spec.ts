import { test, expect } from '@playwright/test';

test.describe('Forecast page smoke', () => {
  test('demand forecast page renders without errors', async ({ page }) => {
    const consoleErrors: string[] = [];
    page.on('console', (msg) => { if (msg.type() === 'error') consoleErrors.push(msg.text()); });
    page.on('pageerror', (err) => consoleErrors.push(err.message));

    await page.goto('/ai/forecast');
    await page.waitForLoadState('networkidle');

    await expect(page.getByText(/forecast|demand|predict/i)).toBeVisible();
    expect(consoleErrors).toEqual([]);
  });
});