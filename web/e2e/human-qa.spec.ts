import { test, expect } from '@playwright/test';
import {
  loginViaUi,
  getToken,
  authHeaders,
  QA_API_URL,
  sidebarLink,
  waitForLeadsTable,
  leadsSearch,
  leadsTableRows,
} from './helpers';

test.describe('Frontend human QA personas', () => {
  test.beforeEach(async ({ page }) => {
    await loginViaUi(page, 'manager@wizag.local');
  });

  test('impatient user: rapid sidebar navigation does not crash', async ({ page }) => {
    const links = ['Leads', 'Pipeline', 'Reports', 'My calendar', 'Overview'];
    for (let round = 0; round < 2; round++) {
      for (const name of links) {
        await sidebarLink(page, name).click({ timeout: 5_000 });
      }
    }
    await expect(page.locator('.app-shell')).toBeVisible();
    await expect(page.locator('.alert-error')).toHaveCount(0);
  });

  test('receptionist: search leads filters list client-side', async ({ page }) => {
    await sidebarLink(page, 'Leads').click();
    await waitForLeadsTable(page);
    const search = leadsSearch(page);
    await search.fill('zzzz-no-match-qa');
    await expect(page.getByText('No leads found.')).toBeVisible({ timeout: 10_000 });
    await search.fill('');
    await expect(leadsTableRows(page).first()).toBeVisible({ timeout: 15_000 });
  });

  test('refresh during load: overview recovers after reload', async ({ page }) => {
    await sidebarLink(page, 'Overview').click();
    await page.reload();
    await expect(page.getByLabel('My personal dashboard')).toBeVisible({ timeout: 20_000 });
  });

  test('workflow abandonment: open create lead then cancel', async ({ page }) => {
    await sidebarLink(page, 'Leads').click();
    const newLead = page.getByRole('button', { name: /new lead/i });
    if (await newLead.isVisible()) {
      await newLead.click();
      await expect(page.locator('.modal-backdrop')).toBeVisible();
      await page.getByRole('button', { name: 'Cancel' }).click();
      await expect(page.locator('.modal-backdrop')).toHaveCount(0);
    }
  });

  test('multi-tab: second tab shares auth via localStorage', async ({ context, page }) => {
    await sidebarLink(page, 'Leads').click();
    const page2 = await context.newPage();
    await page2.goto('/');
    await expect(page2.getByLabel('My personal dashboard')).toBeVisible({ timeout: 20_000 });
    await page2.close();
  });
});

test.describe('State verification (API, not UI-only)', () => {
  test('leads page count matches API after login', async ({ page, request }) => {
    const token = await getToken(request, 'manager@wizag.local');
    const apiRes = await request.get(`${QA_API_URL}/leads`, { headers: authHeaders(token) });
    expect(apiRes.ok()).toBeTruthy();
    const apiBody = (await apiRes.json()) as { leads: unknown[] };
    const apiCount = apiBody.leads?.length ?? 0;

    await loginViaUi(page, 'manager@wizag.local');
    await sidebarLink(page, 'Leads').click();
    await waitForLeadsTable(page);
    const rowCount = await leadsTableRows(page).count();
    expect(rowCount).toBe(apiCount);
  });
});
