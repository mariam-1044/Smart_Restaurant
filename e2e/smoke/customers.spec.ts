import { test, expect } from '@playwright/test';

test.describe('Customers page smoke', () => {
  test('customers page renders without errors', async ({ page }) => {
    const consoleErrors: string[] = [];
    page.on('console', (msg) => { if (msg.type() === 'error') consoleErrors.push(msg.text()); });
    page.on('pageerror', (err) => consoleErrors.push(err.message));

    await page.goto('/customers');
    await page.waitForLoadState('networkidle');

    await expect(page.getByText(/customer/i)).toBeVisible();
    expect(consoleErrors).toEqual([]);
  });

  test('seeded customers are visible', async ({ page }) => {
    const consoleErrors: string[] = [];
    page.on('console', (msg) => { if (msg.type() === 'error') consoleErrors.push(msg.text()); });
    page.on('pageerror', (err) => consoleErrors.push(err.message));

    await page.goto('/customers');
    await page.waitForLoadState('networkidle');

    await expect(page.getByText(/john doe/i)).toBeVisible();
    expect(consoleErrors).toEqual([]);
  });
});