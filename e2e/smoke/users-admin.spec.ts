import { test, expect } from '@playwright/test';

test.describe('Users admin smoke', () => {
  test('users management page renders without errors', async ({ page }) => {
    const consoleErrors: string[] = [];
    page.on('console', (msg) => { if (msg.type() === 'error') consoleErrors.push(msg.text()); });
    page.on('pageerror', (err) => consoleErrors.push(err.message));

    await page.goto('/admin/users');
    await page.waitForLoadState('networkidle');

    await expect(page.getByText(/user/i)).toBeVisible();
    expect(consoleErrors).toEqual([]);
  });

  test('seeded users are visible', async ({ page }) => {
    const consoleErrors: string[] = [];
    page.on('console', (msg) => { if (msg.type() === 'error') consoleErrors.push(msg.text()); });
    page.on('pageerror', (err) => consoleErrors.push(err.message));

    await page.goto('/admin/users');
    await page.waitForLoadState('networkidle');

    await expect(page.getByText(/admin@e2e\.local/i)).toBeVisible();
    expect(consoleErrors).toEqual([]);
  });
});