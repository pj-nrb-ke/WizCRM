import { expect, type APIRequestContext, type Page } from '@playwright/test';

export const QA_API_URL = (process.env.QA_API_URL ?? 'https://api.wizcrm.app').replace(/\/$/, '');
export const SEED_PASSWORD = process.env.QA_PASSWORD ?? 'wizcrm123';

export async function loginViaUi(
  page: Page,
  email: string,
  password: string = SEED_PASSWORD,
): Promise<void> {
  await page.goto('/login');
  await page.locator('#email').fill(email);
  await page.locator('#password').fill(password);
  await page.getByRole('button', { name: 'Sign in' }).click();
  await expect(page).not.toHaveURL(/\/login$/);
}

export async function getToken(request: APIRequestContext, email: string): Promise<string> {
  const res = await request.post(`${QA_API_URL}/auth/login`, {
    data: { email, password: SEED_PASSWORD },
  });
  expect(res.ok(), `login API for ${email}`).toBeTruthy();
  const body = (await res.json()) as { token: string };
  expect(body.token).toBeTruthy();
  return body.token;
}

export function authHeaders(token: string): Record<string, string> {
  return { Authorization: `Bearer ${token}` };
}

/** Sidebar nav only — avoids duplicate quick-tile links on the home page. */
export function sidebarLink(page: Page, name: string) {
  return page.locator('nav.sidebar-nav').getByRole('link', { name, exact: true });
}

export async function waitForLeadsTable(page: Page): Promise<void> {
  await expect(page.getByRole('heading', { name: /all leads/i })).toBeVisible({ timeout: 20_000 });
  await expect(page.getByText('Loading…')).toHaveCount(0, { timeout: 30_000 });
}

export function leadsSearch(page: Page) {
  return page.getByRole('searchbox', { name: 'Search leads' });
}

export function leadsTableRows(page: Page) {
  return page.locator('table tbody tr');
}
