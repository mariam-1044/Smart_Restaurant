import { test, expect } from '@playwright/test';

test.describe('Waste page smoke', () => {
  test('waste page renders without errors', async ({ page }) => {
    const consoleErrors: string[] = [];
    page.on('console', (msg) => { if (msg.type() === 'error') consoleErrors.push(msg.text()); });
    page.on('pageerror', (err) => consoleErrors.push(err.message));

    await page.goto('/waste');
    await page.waitForLoadState('networkidle');

    await expect(page.getByText(/waste/i)).toBeVisible();
    expect(consoleErrors).toEqual([]);
  });
});