import { test, expect } from '@playwright/test';
import {
  loginViaUi,
  sidebarLink,
  waitForLeadsTable,
  leadsSearch,
  leadsTableRows,
  getToken,
  authHeaders,
  QA_API_URL,
} from './helpers';
import {
  attachConsoleCollector,
  assertNoSevereConsole,
  apiLeadCount,
  apiOpenLeadCount,
  createLeadApi,
  managerToken,
  waitNoSpinner,
  apiMeUserId,
} from './enterprise-helpers';

test.beforeEach(async ({ page }) => {
  attachConsoleCollector(page);
});

test.describe('Frontend Sync Tests', () => {
  test('create via API → UI row count matches backend after refresh', async ({ page, request }) => {
    const token = await managerToken(request);
    const before = await apiLeadCount(request, token);
    const mark = `E002-sync-${Date.now()}`;
    const phone = `+2762${Date.now().toString().slice(-7)}`;
    await createLeadApi(request, token, { name: mark, phone });

    await loginViaUi(page, 'manager@wizag.local');
    await sidebarLink(page, 'Leads').click();
    await waitForLeadsTable(page);
    await page.getByRole('button', { name: 'Refresh' }).click();
    await waitForLeadsTable(page);

    const afterApi = await apiLeadCount(request, token);
    expect(afterApi).toBe(before + 1);
    const uiRows = await leadsTableRows(page).count();
    expect(uiRows).toBe(afterApi);
    await leadsSearch(page).fill(mark);
    await expect(leadsTableRows(page)).toHaveCount(1);
  });

  test('PATCH via API → drawer shows updated name', async ({ page, request }) => {
    const token = await managerToken(request);
    const mark = `E002-edit-${Date.now()}`;
    const phone = `+2763${Date.now().toString().slice(-7)}`;
    const id = await createLeadApi(request, token, { name: mark, phone });
    const renamed = `${mark}-renamed`;
    const patch = await request.patch(`${QA_API_URL}/leads/${id}`, {
      headers: authHeaders(token),
      data: { name: renamed, confirmStageSuggestion: true },
    });
    expect(patch.ok()).toBeTruthy();
    const got = await request.get(`${QA_API_URL}/leads/${id}`, { headers: authHeaders(token) });
    expect((await got.json()).lead.name).toBe(renamed);

    await loginViaUi(page, 'manager@wizag.local');
    await sidebarLink(page, 'Leads').click();
    await waitForLeadsTable(page);
    await leadsSearch(page).fill(mark);
    await leadsTableRows(page).first().click();
    await expect(page.locator('.drawer-tabs')).toBeVisible();
    await expect(page.locator('aside.drawer h2')).toHaveText(renamed, { timeout: 10_000 });
  });

  test('dashboard openLeads matches owner-scoped API count', async ({ page, request }) => {
    const token = await managerToken(request);
    const userId = await apiMeUserId(request, token);
    const openMine = await apiOpenLeadCount(request, token, userId);

    await loginViaUi(page, 'manager@wizag.local');
    const kpi = page.locator('.kpi-card').filter({ hasText: 'My open leads' });
    await expect(kpi).toBeVisible({ timeout: 15_000 });
    const uiNum = Number((await kpi.locator('.kpi-card-value').textContent())?.replace(/,/g, '') ?? '');
    expect(uiNum).toBe(openMine);
  });
});

test.describe('Duplicate Prevention Tests', () => {
  test('double-click Create lead does not create duplicate rows', async ({ page, request }) => {
    const token = await managerToken(request);
    const before = await apiLeadCount(request, token);
    const phone = `+2764${Date.now().toString().slice(-7)}`;
    const mark = `E002-dup-${Date.now()}`;

    await loginViaUi(page, 'manager@wizag.local');
    await sidebarLink(page, 'Leads').click();
    await waitForLeadsTable(page);
    await page.getByRole('button', { name: 'New lead' }).click();
    const modal = page.locator('.modal-panel');
    await modal.getByLabel(/^Name/i).fill(mark);
    await modal.getByLabel(/^Email/i).fill(`dup-${Date.now()}@test.local`);
    await modal.getByLabel(/^Phone/i).fill(phone);
    const createBtn = page.getByRole('button', { name: 'Create lead' });
    await createBtn.dblclick();
    await page.waitForTimeout(2500);
    await expect(page.locator('.modal-backdrop')).toHaveCount(0, { timeout: 15_000 }).catch(() => {});

    const after = await apiLeadCount(request, token);
    expect(after - before).toBeLessThanOrEqual(1);

    const list = await request.get(`${QA_API_URL}/leads`, { headers: authHeaders(token) });
    const byName = ((await list.json()) as { leads: { name: string }[] }).leads.filter((l) =>
      l.name.includes(mark),
    );
    expect(byName.length).toBeLessThanOrEqual(1);

    await page.getByRole('button', { name: 'Close' }).click({ timeout: 3000 }).catch(() => {});
    await expect(page.locator('.drawer-backdrop')).toHaveCount(0, { timeout: 8_000 });
    await page.getByRole('button', { name: 'Refresh' }).click();
    await waitForLeadsTable(page);
    await leadsSearch(page).fill(mark);
    expect(await leadsTableRows(page).count()).toBeLessThanOrEqual(1);
  });

  test('duplicate phone via API returns 409 only one row', async ({ request }) => {
    const token = await getToken(request, 'rep@wizag.local');
    const phone = `+2765${Date.now().toString().slice(-7)}`;
    const r1 = await request.post(`${QA_API_URL}/leads`, {
      headers: authHeaders(token),
      data: { name: 'Dup A', phone },
    });
    expect(r1.status()).toBe(201);
    const r2 = await request.post(`${QA_API_URL}/leads`, {
      headers: authHeaders(token),
      data: { name: 'Dup B', phone },
    });
    expect(r2.status()).toBe(409);
    const list = await request.get(`${QA_API_URL}/leads`, { headers: authHeaders(token) });
    const count = ((await list.json()) as { leads: { phone?: string }[] }).leads.filter(
      (l) => l.phone === phone,
    ).length;
    expect(count).toBe(1);
  });
});

test.describe('Race Condition Tests', () => {
  test('rapid filter + search ends consistent with API', async ({ page, request }) => {
    const token = await managerToken(request);
    await loginViaUi(page, 'manager@wizag.local');
    await sidebarLink(page, 'Leads').click();
    await waitForLeadsTable(page);
    const search = leadsSearch(page);
    for (let i = 0; i < 8; i++) {
      await page.getByRole('combobox', { name: 'Filter by stage' }).selectOption(i % 2 === 0 ? 'NEW' : '');
      await search.fill(i % 2 === 0 ? 'a' : '');
      await search.fill('');
    }
    await waitNoSpinner(page);
    const uiCount = await leadsTableRows(page).count();
    const apiCount = await apiLeadCount(request, token);
    expect(uiCount).toBe(apiCount);
  });

  test('rapid modal open/close leaves single backdrop', async ({ page }) => {
    await loginViaUi(page, 'manager@wizag.local');
    await sidebarLink(page, 'Leads').click();
    await waitForLeadsTable(page);
    for (let i = 0; i < 6; i++) {
      await page.getByRole('button', { name: 'New lead' }).click();
      await page.keyboard.press('Escape').catch(() => {});
      await page.getByRole('button', { name: 'Cancel' }).click({ timeout: 2000 }).catch(() => {});
    }
    await expect(page.locator('.modal-backdrop')).toHaveCount(0);
  });
});

test.describe('Session Recovery Tests', () => {
  test('reload during leads load recovers with matching API count', async ({ page, request }) => {
    const token = await managerToken(request);
    const expected = await apiLeadCount(request, token);
    await loginViaUi(page, 'manager@wizag.local');
    await sidebarLink(page, 'Leads').click();
    await page.reload();
    await waitForLeadsTable(page);
    expect(await leadsTableRows(page).count()).toBe(expected);
  });

  test('reload on overview keeps session and dashboard', async ({ page }) => {
    await loginViaUi(page, 'manager@wizag.local');
    await page.reload();
    await expect(page.getByLabel('My personal dashboard')).toBeVisible({ timeout: 20_000 });
    await expect(page).not.toHaveURL(/\/login/);
  });
});

test.describe('Multi-Tab Tests', () => {
  test('edit in API visible after refresh in second tab', async ({ context, page, request }) => {
    const token = await managerToken(request);
    const mark = `E002-tab-${Date.now()}`;
    const id = await createLeadApi(request, token, {
      name: mark,
      phone: `+2766${Date.now().toString().slice(-7)}`,
    });
    const renamed = `${mark}-tab2`;

    await loginViaUi(page, 'manager@wizag.local');
    await sidebarLink(page, 'Leads').click();
    await waitForLeadsTable(page);
    await leadsSearch(page).fill(mark);
    await leadsTableRows(page).first().click();

    const page2 = await context.newPage();
    await page2.goto('/leads');
    await expect(page2.getByRole('heading', { name: /all leads/i })).toBeVisible({ timeout: 20_000 });
    await waitNoSpinner(page2);

    await request.patch(`${QA_API_URL}/leads/${id}`, {
      headers: authHeaders(token),
      data: { name: renamed, confirmStageSuggestion: true },
    });

    await page2.reload();
    await waitForLeadsTable(page2);
    await leadsSearch(page2).fill(renamed);
    await expect(leadsTableRows(page2)).toHaveCount(1, { timeout: 15_000 });
    await expect(leadsTableRows(page2).first()).toContainText(renamed);
    await page2.close();
  });

  test('logout in tab A forces re-auth on protected navigation in tab B', async ({ context, page }) => {
    await loginViaUi(page, 'manager@wizag.local');
    const page2 = await context.newPage();
    await page2.goto('/');
    await expect(page2.getByLabel('My personal dashboard')).toBeVisible({ timeout: 15_000 });

    await page.getByRole('button', { name: 'Log out' }).click();
    await page2.goto('/leads');
    await expect(page2).toHaveURL(/\/login/, { timeout: 15_000 });
    await page2.close();
  });
});

test.describe('Long-Duration Stability', () => {
  test('60 navigation cycles — stable counts, bounded heap, no severe console', async ({
    page,
    request,
    browserName,
  }) => {
    test.setTimeout(120_000);
    const logs = attachConsoleCollector(page);
    const token = await managerToken(request);
    const baseline = await apiLeadCount(request, token);

    await loginViaUi(page, 'manager@wizag.local');
    const heapBefore =
      browserName === 'chromium'
        ? await page.evaluate(
            () =>
              (performance as Performance & { memory?: { usedJSHeapSize: number } }).memory
                ?.usedJSHeapSize ?? 0,
          )
        : 0;

    for (let i = 0; i < 60; i++) {
      await sidebarLink(page, i % 2 === 0 ? 'Leads' : 'Overview').click({ timeout: 8_000 });
      if (i % 5 === 0 && (await page.getByText('Loading…').count()) > 0) {
        await waitNoSpinner(page, 12_000);
      }
    }

    await sidebarLink(page, 'Leads').click();
    await waitForLeadsTable(page);
    const uiCount = await leadsTableRows(page).count();
    const apiCount = await apiLeadCount(request, token);
    expect(apiCount).toBe(baseline);
    expect(uiCount).toBe(apiCount);

    if (heapBefore > 0) {
      const heapAfter = await page.evaluate(
        () =>
          (performance as Performance & { memory?: { usedJSHeapSize: number } }).memory
            ?.usedJSHeapSize ?? 0,
      );
      expect((heapAfter - heapBefore) / (1024 * 1024)).toBeLessThan(100);
    }
    assertNoSevereConsole(logs);
  });
});

test.describe('Human Frustration Observations', () => {
  test('new lead modal requires explicit Cancel (Escape ineffective)', async ({ page }) => {
    const logs = attachConsoleCollector(page);
    await loginViaUi(page, 'manager@wizag.local');
    await sidebarLink(page, 'Leads').click();
    await waitForLeadsTable(page);
    await page.getByRole('button', { name: 'New lead' }).click();
    await page.keyboard.press('Escape');
    const backdropVisible = await page.locator('.modal-backdrop').isVisible();
    if (backdropVisible) {
      test.info().annotations.push({
        type: 'ux-finding',
        description: 'UX-005: New lead modal does not dismiss on Escape — extra click required.',
      });
    }
    await page.getByRole('button', { name: 'Cancel' }).click();
    await expect(page.locator('.modal-backdrop')).toHaveCount(0);
    assertNoSevereConsole(logs);
  });
});
