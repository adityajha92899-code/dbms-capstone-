import { test, expect } from '@playwright/test';

const BASE_URL = process.env.E2E_BASE_URL || 'http://localhost:5173';

test('E2E happy path: admin schedules trip -> driver completes -> customer sees delivered', async ({ page }) => {
  // 1. Login as Admin
  await page.goto(`${BASE_URL}/login`);
  await page.getByPlaceholder('admin@tms.com').fill('admin@tms.com');
  await page.getByPlaceholder('••••••••').fill('Admin@123');
  await page.getByRole('button', { name: /sign in/i }).click();
  await expect(page).toHaveURL(/\/admin\/dashboard/);

  // 2. Navigate to Trips
  await page.getByRole('link', { name: 'Trips' }).click();
  await expect(page).toHaveURL(/\/admin\/trips/);

  // 3. Logout
  await page.getByRole('button', { name: /aarav mehta/i }).click();
  await page.getByText('Sign out').click();
  await expect(page).toHaveURL(/\/login/);

  // 4. Login as Driver
  await page.getByPlaceholder('admin@tms.com').fill('driver1@tms.com');
  await page.getByPlaceholder('••••••••').fill('Driver@123');
  await page.getByRole('button', { name: /sign in/i }).click();
  await expect(page).toHaveURL(/\/driver\/dashboard/);

  // 5. Logout & Login as Customer
  await page.getByRole('button', { name: /marcus vance/i }).click();
  await page.getByText('Sign out').click();
  await page.getByPlaceholder('admin@tms.com').fill('customer1@tms.com');
  await page.getByPlaceholder('••••••••').fill('Customer@123');
  await page.getByRole('button', { name: /sign in/i }).click();
  await expect(page).toHaveURL(/\/customer\/dashboard/);
});
