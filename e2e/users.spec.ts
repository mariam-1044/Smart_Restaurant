import { test, expect } from '@playwright/test';
import { SEED_ADMIN, SEED_STAFF, SEED_PENDING } from './fixtures/users';

test.describe('User management (admin)', () => {
  test('user list shows seeded users', async ({ page }) => {
    await page.goto('/admin/users');
    await page.waitForLoadState('networkidle');

    await expect(page.getByText(SEED_ADMIN.email)).toBeVisible();
    await expect(page.getByText(SEED_STAFF.email)).toBeVisible();
  });

  test('pending user is visible in user list', async ({ page }) => {
    await page.goto('/admin/users');
    await page.waitForLoadState('networkidle');

    await expect(page.getByText(SEED_PENDING.email)).toBeVisible();
  });

  test('approve a pending user', async ({ page }) => {
    await page.goto('/admin/users');
    await page.waitForLoadState('networkidle');

    const pendingRow = page.getByRole('row').filter({ hasText: SEED_PENDING.email });
    await expect(pendingRow).toBeVisible();
    const approveBtn = pendingRow.getByRole('button', { name: /approve/i });
    await expect(approveBtn).toBeVisible();
    await approveBtn.click();

    await expect(pendingRow.getByText(/approved/i)).toBeVisible();
  });

  test('change user role', async ({ page }) => {
    await page.goto('/admin/users');
    await page.waitForLoadState('networkidle');

    const staffRow = page.getByRole('row').filter({ hasText: SEED_STAFF.email });
    await expect(staffRow).toBeVisible();
    const roleSelect = staffRow.getByRole('combobox', { name: /role/i });
    await expect(roleSelect).toBeVisible();
    await roleSelect.selectOption('admin');
    await expect(page.getByText(/success|updated/i)).toBeVisible();
  });
});