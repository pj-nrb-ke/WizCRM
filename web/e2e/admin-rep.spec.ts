import { test, expect } from '@playwright/test';
import { loginViaUi, sidebarLink } from './helpers';

test.describe('Role-based access', () => {
  test('admin reaches users page', async ({ page }) => {
    await loginViaUi(page, 'admin@wizag.local');
    await sidebarLink(page, 'Users').click();
    await expect(page.getByRole('heading', { name: 'Users', level: 1 })).toBeVisible({ timeout: 15_000 });
  });

  test('sales rep overview loads personal dashboard', async ({ page }) => {
    await loginViaUi(page, 'rep@wizag.local');
    await expect(page.getByLabel('My personal dashboard')).toBeVisible({ timeout: 20_000 });
    await expect(page.getByRole('link', { name: 'Leads' })).toHaveCount(0);
  });
});
