import { test, expect } from '@playwright/test';

test.describe('Inventory export', () => {
  test('inventory page shows seeded ingredients', async ({ page }) => {
    await page.goto('/inventory');
    await page.waitForLoadState('networkidle');

    await expect(page.getByText(/tomato/i)).toBeVisible();
  });

  test('export inventory as CSV', async ({ page }) => {
    await page.goto('/inventory');
    await page.waitForLoadState('networkidle');

    const exportBtn = page.getByRole('button', { name: /export|download|csv/i });
    await expect(exportBtn).toBeVisible();
    const [downloadObj] = await Promise.all([
      page.waitForEvent('download'),
      exportBtn.click()
    ]);

    expect(downloadObj.suggestedFilename()).toMatch(/\.csv$/i);
    const stream = await downloadObj.createReadStream();
    let csvContent = '';
    for await (const chunk of stream) {
      csvContent += chunk.toString();
    }
    expect(csvContent.startsWith('name,quantity,unit,minStock,costPerUnit,expiryDate,wasteQuantity')).toBeTruthy();
  });

  test('low-stock ingredient is flagged', async ({ page }) => {
    await page.goto('/inventory');
    await page.waitForLoadState('networkidle');

    const tomatoRow = page.getByRole('row').filter({ hasText: /tomato/i });
    await expect(tomatoRow).toBeVisible();
    const lowStockIndicator = tomatoRow.getByText(/low|warning|below/i);
    await expect(lowStockIndicator).toBeVisible();
  });

  test('inventory detail page loads', async ({ page }) => {
    await page.goto('/inventory');
    await page.waitForLoadState('networkidle');

    const ingredientLink = page.getByRole('link', { name: /tomato/i }).first();
    await expect(ingredientLink).toBeVisible();
    const navPromise = page.waitForURL(/\/inventory\//);
    await ingredientLink.click();
    await navPromise;

    await expect(page.getByText(/tomato/i)).toBeVisible();
  });
});