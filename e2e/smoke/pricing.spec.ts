import { test, expect } from '@playwright/test';

test.describe('Pricing page smoke', () => {
  test('dynamic pricing page renders without errors', async ({ page }) => {
    const consoleErrors: string[] = [];
    page.on('console', (msg) => { if (msg.type() === 'error') consoleErrors.push(msg.text()); });
    page.on('pageerror', (err) => consoleErrors.push(err.message));

    await page.goto('/ai/pricing');
    await page.waitForLoadState('networkidle');

    await expect(page.getByText(/pricing|price/i)).toBeVisible();
    expect(consoleErrors).toEqual([]);
  });
});