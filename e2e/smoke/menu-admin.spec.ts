import { test, expect } from '@playwright/test';

test.describe('Menu admin smoke', () => {
  test('menu management page renders without errors', async ({ page }) => {
    const consoleErrors: string[] = [];
    page.on('console', (msg) => { if (msg.type() === 'error') consoleErrors.push(msg.text()); });
    page.on('pageerror', (err) => consoleErrors.push(err.message));

    await page.goto('/admin/menu');
    await page.waitForLoadState('networkidle');

    await expect(page.getByText(/menu|dish/i)).toBeVisible();
    expect(consoleErrors).toEqual([]);
  });

  test('seeded dishes are visible', async ({ page }) => {
    const consoleErrors: string[] = [];
    page.on('console', (msg) => { if (msg.type() === 'error') consoleErrors.push(msg.text()); });
    page.on('pageerror', (err) => consoleErrors.push(err.message));

    await page.goto('/admin/menu');
    await page.waitForLoadState('networkidle');

    await expect(page.getByText(/margherita/i)).toBeVisible();
    expect(consoleErrors).toEqual([]);
  });
});