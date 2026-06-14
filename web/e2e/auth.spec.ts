import { test, expect } from '@playwright/test';
import { loginViaUi, sidebarLink } from './helpers';

test.describe('Auth — core login', () => {
  test('manager signs in and lands on overview with nav', async ({ page }) => {
    await loginViaUi(page, 'manager@wizag.local');
    await expect(page.getByLabel('My personal dashboard')).toBeVisible({ timeout: 20_000 });
    await expect(sidebarLink(page, 'Leads')).toBeVisible();
    await expect(sidebarLink(page, 'Pipeline')).toBeVisible();
  });

  test('invalid password shows error and stays on login', async ({ page }) => {
    await page.goto('/login');
    await page.locator('#email').fill('manager@wizag.local');
    await page.locator('#password').fill('wrong-password');
    await page.getByRole('button', { name: 'Sign in' }).click();
    await expect(page.locator('.alert-error')).toBeVisible();
    await expect(page).toHaveURL(/\/login/);
  });

  test('confused user: malformed email shows validation on submit', async ({ page }) => {
    await page.goto('/login');
    await page.locator('#email').fill('not-an-email');
    await page.locator('#password').fill('wizcrm123');
    await page.getByRole('button', { name: 'Sign in' }).click();
    const validity = await page.locator('#email').evaluate((el: HTMLInputElement) => el.validity.valid);
    expect(validity).toBe(false);
    await expect(page).toHaveURL(/\/login/);
  });
});
