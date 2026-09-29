import { test, expect } from '@playwright/test';

test.describe('AI Recipe Generation', () => {
  test('recipe recommendation page loads', async ({ page }) => {
    await page.goto('/recommend');
    await page.waitForLoadState('networkidle');

    await expect(page.getByText(/recommend|recipe|generate/i)).toBeVisible();
  });

  test('generate recipe from ingredients', async ({ page }) => {
    await page.goto('/recommend');
    await page.waitForLoadState('networkidle');

    const generateBtn = page.getByRole('button', { name: /generate|create|recommend/i });
    await expect(generateBtn).toBeVisible();
    await generateBtn.click();

    await expect(page.getByText(/recipe|result|suggestion/i)).toBeVisible();
  });
});