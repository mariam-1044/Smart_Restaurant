import { test, expect } from '@playwright/test';

test.describe('Notification bell', () => {
  test('notification bell shows unread count', async ({ page }) => {
    await page.goto('/dashboard');
    await page.waitForLoadState('networkidle');

    const bell = page.getByRole('button', { name: /notification|bell/i });
    await expect(bell).toBeVisible();
    const badge = page.getByTestId('notification-badge');
    await expect(badge).toBeVisible();
    const count = await badge.textContent();
    expect(Number(count)).toBeGreaterThanOrEqual(1);
  });

  test('clicking bell opens notification panel', async ({ page }) => {
    await page.goto('/dashboard');
    await page.waitForLoadState('networkidle');

    const bell = page.getByRole('button', { name: /notification|bell/i });
    await expect(bell).toBeVisible();
    await bell.click();

    await expect(page.getByText(/low stock|expiry|notification/i)).toBeVisible();
  });

  test('mark notification as read', async ({ page }) => {
    await page.goto('/dashboard');
    await page.waitForLoadState('networkidle');

    const bell = page.getByRole('button', { name: /notification|bell/i });
    await expect(bell).toBeVisible();
    await bell.click();

    const markReadBtn = page.getByRole('button', { name: /mark.*read|dismiss/i }).first();
    await expect(markReadBtn).toBeVisible();
    await markReadBtn.click();

    await expect(markReadBtn).not.toBeVisible();
  });

  test('low-stock condition triggers notification badge', async ({ page, request }) => {
    await request.post('/api/orders', {
      data: {
        items: [{ name: 'Tomato', quantity: 2 }],
      },
    });

    await page.goto('/dashboard');
    await page.waitForLoadState('networkidle');

    const bell = page.getByRole('button', { name: /notification|bell/i });
    await expect(bell).toBeVisible();
    await bell.click();

    await expect(page.getByText(/low stock|tomato/i)).toBeVisible();
  });
});