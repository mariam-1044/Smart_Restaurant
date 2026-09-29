import { test, expect } from '@playwright/test';
import { SEED_ADMIN, SEED_STAFF, SEED_PENDING } from './fixtures/users';

test.use({ storageState: { cookies: [], origins: [] } });

test.describe('Auth', () => {
  test('login with valid admin credentials', async ({ page }) => {
    await page.goto('/');

    await page.getByLabel(/email/i).fill(SEED_ADMIN.email);
    await page.getByLabel(/password/i).fill(SEED_ADMIN.password);
    await page.getByRole('button', { name: /login|sign in/i }).click();

    await expect(page).toHaveURL(/\/dashboard/);
  });

  test('login fails with wrong password', async ({ page }) => {
    await page.goto('/');

    await page.getByLabel(/email/i).fill(SEED_ADMIN.email);
    await page.getByLabel(/password/i).fill('WrongPassword!23');
    await page.getByRole('button', { name: /login|sign in/i }).click();

    await expect(page.getByText(/invalid|incorrect|wrong/i)).toBeVisible();
  });

  test('pending user cannot login', async ({ page }) => {
    await page.goto('/');

    await page.getByLabel(/email/i).fill(SEED_PENDING.email);
    await page.getByLabel(/password/i).fill(SEED_PENDING.password);
    await page.getByRole('button', { name: /login|sign in/i }).click();

    await expect(page.getByText(/pending|status/i)).toBeVisible();
  });

  test('logout clears session and redirects to login', async ({ page }) => {
    await page.goto('/');

    await page.getByLabel(/email/i).fill(SEED_ADMIN.email);
    await page.getByLabel(/password/i).fill(SEED_ADMIN.password);
    await page.getByRole('button', { name: /login|sign in/i }).click();

    await expect(page).toHaveURL(/\/dashboard/);

    await page.getByRole('button', { name: /logout|sign out/i }).click();

    await expect(page).toHaveURL(/\/(login)?$/); 
  });
});