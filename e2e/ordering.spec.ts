import { test, expect } from '@playwright/test';

test.describe('Ordering flow', () => {
  test('create an order from the POS page', async ({ page }) => {
    await page.goto('/order');
    await page.waitForLoadState('networkidle');

    await expect(page.getByText(/margherita|menu/i)).toBeVisible();

    const firstDish = page.getByRole('button', { name: /margherita/i }).first();
    await expect(firstDish).toBeVisible();
    await firstDish.click();

    await page.getByRole('button', { name: /submit|place order|confirm/i }).click();

    await expect(page.getByText(/order.*(?:created|success|submitted)/i)).toBeVisible();
  });

  test('order list shows existing orders', async ({ page }) => {
    await page.goto('/sales');
    await page.waitForLoadState('networkidle');

    await expect(page.getByText(/order|sales/i)).toBeVisible();
  });

  test('order detail page loads', async ({ page }) => {
    await page.goto('/sales');
    await page.waitForLoadState('networkidle');

    const orderRow = page.getByRole('row').first();
    await expect(orderRow).toBeVisible();
    await orderRow.click();
    await expect(page.getByText(/status|total|order/i)).toBeVisible();
  });

  test('placing an order deducts inventory quantity', async ({ page, request }) => {
    const beforeRes = await request.get('/api/inventory');
    const inventoryBefore = await beforeRes.json();
    const tomatoBefore = inventoryBefore.find((item: any) => /tomato/i.test(item.name));
    expect(tomatoBefore).toBeTruthy();

    await page.goto('/order');
    await page.waitForLoadState('networkidle');

    const firstDish = page.getByRole('button', { name: /margherita/i }).first();
    await expect(firstDish).toBeVisible();
    await firstDish.click();

    await page.getByRole('button', { name: /submit|place order|confirm/i }).click();
    await expect(page.getByText(/order.*(?:created|success|submitted)/i)).toBeVisible();

    const afterRes = await request.get('/api/inventory');
    const inventoryAfter = await afterRes.json();
    const tomatoAfter = inventoryAfter.find((item: any) => /tomato/i.test(item.name));
    expect(tomatoAfter.quantity).toBeLessThan(tomatoBefore.quantity);
  });
});