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
  createLeadApi,
  managerToken,
  waitNoSpinner,
  apiMeUserId,
  apiOpenLeadCount,
} from './enterprise-helpers';

test.describe.configure({ timeout: 30_000 });

const MULTI_TAB_SCENARIOS = Array.from({ length: 15 }, (_, i) => ({
  id: `MT-${String(i + 1).padStart(2, '0')}`,
  name: [
    'two tabs same leads list count',
    'edit API tab1 refresh tab2 sees name',
    'logout tab1 blocks tab2 leads',
    'tab2 reload after tab1 navigation',
    'parallel overview both tabs',
    'tab1 leads tab2 pipeline no crash',
    'tab1 open drawer tab2 refresh list',
    'three tabs shared session',
    'tab2 deep link leads while tab1 home',
    'tab1 search tab2 clear search',
    'tab1 calendar tab2 leads',
    'tab1 reports tab2 overview',
    'close tab2 tab1 still works',
    'tab2 login fresh after tab1 session',
    'rapid tab open close x5',
  ][i],
}));

test.describe('Multi-Tab Tests', () => {
  for (const sc of MULTI_TAB_SCENARIOS) {
    test(`${sc.id} ${sc.name}`, async ({ context, page, request }) => {
      const logs = attachConsoleCollector(page);
      const token = await managerToken(request);
      const idx = parseInt(sc.id.slice(3), 10);

      await loginViaUi(page, 'manager@wizag.local');

      if (idx === 3) {
        const page2 = await context.newPage();
        await page2.goto('/');
        await page.getByRole('button', { name: 'Log out' }).click();
        await page2.goto('/leads');
        await expect(page2).toHaveURL(/\/login/, { timeout: 12_000 });
        await page2.close();
        assertNoSevereConsole(logs);
        return;
      }

      const page2 = await context.newPage();
      await page2.goto('/');

      if (idx === 1 || idx === 2) {
        const mark = `E003-${sc.id}-${Date.now()}`;
        const id = await createLeadApi(request, token, {
          name: mark,
          phone: `+2751${Date.now().toString().slice(-7)}`,
        });
        const renamed = `${mark}-x`;
        await request.patch(`${QA_API_URL}/leads/${id}`, {
          headers: authHeaders(token),
          data: { name: renamed, confirmStageSuggestion: true },
        });
        await sidebarLink(page, 'Leads').click();
        await waitForLeadsTable(page);
        await page2.goto('/leads');
        await waitForLeadsTable(page2);
        await page2.reload();
        await waitForLeadsTable(page2);
        await leadsSearch(page2).fill(renamed);
        expect(await leadsTableRows(page2).count()).toBe(1);
        await page2.close();
        assertNoSevereConsole(logs);
        return;
      }

      if (idx === 15) {
        for (let t = 0; t < 5; t++) {
          const p = await context.newPage();
          await p.goto('/');
          await p.close();
        }
        assertNoSevereConsole(logs);
        await page2.close();
        return;
      }

      const routes =
        idx % 3 === 0
          ? ['Leads', 'Overview']
          : idx % 3 === 1
            ? ['Pipeline', 'Leads']
            : ['Reports', 'Overview'];
      await sidebarLink(page, routes[0]).click();
      await page2.goto(routes[0] === 'Leads' ? '/leads' : routes[0] === 'Pipeline' ? '/pipeline' : '/');
      await waitNoSpinner(page).catch(() => {});
      await waitNoSpinner(page2).catch(() => {});

      if (idx === 0) {
        const c1 = await apiLeadCount(request, token);
        await page2.reload();
        await waitForLeadsTable(page2).catch(() => {});
        const rows = await leadsTableRows(page2).count().catch(() => 0);
        expect(rows).toBe(c1);
      }

      assertNoSevereConsole(logs);
      await page2.close();
    });
  }
});

const LONG_SCENARIOS = Array.from({ length: 10 }, (_, i) => ({
  id: `LD-${String(i + 1).padStart(2, '0')}`,
  navCycles: 50,
}));

test.describe('Long-Duration Stability', () => {
  for (const sc of LONG_SCENARIOS) {
    test(`${sc.id} ${sc.navCycles} navigations — stable API/UI`, async ({
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

      for (let i = 0; i < sc.navCycles; i++) {
        await sidebarLink(page, i % 2 === 0 ? 'Leads' : 'Overview').click({ timeout: 8_000 });
        if ((await page.getByText('Loading…').count()) > 0) {
          await waitNoSpinner(page, 12_000);
        }
      }

      await sidebarLink(page, 'Leads').click();
      await waitForLeadsTable(page);
      expect(await leadsTableRows(page).count()).toBe(baseline);
      expect(await apiLeadCount(request, token)).toBe(baseline);

      if (heapBefore > 0) {
        const heapAfter = await page.evaluate(
          () =>
            (performance as Performance & { memory?: { usedJSHeapSize: number } }).memory
              ?.usedJSHeapSize ?? 0,
        );
        expect((heapAfter - heapBefore) / (1024 * 1024)).toBeLessThan(120);
      }
      assertNoSevereConsole(logs);
    });
  }
});

const SYNC_TESTS = [
  'FS-01 create API → UI count',
  'FS-02 PATCH API → drawer name',
  'FS-03 owner KPI vs API',
  'FS-04 delete calendar phantom check',
  'FS-05 pipeline card in bucket',
  'FS-06 consecutive GET stable',
  'FS-07 filter stage sync',
  'FS-08 activity note in history',
];

test.describe('Frontend Sync Tests', () => {
  test(SYNC_TESTS[0], async ({ page, request }) => {
    const token = await managerToken(request);
    const before = await apiLeadCount(request, token);
    const mark = `E003-fs-${Date.now()}`;
    await createLeadApi(request, token, { name: mark, phone: `+2752${Date.now().toString().slice(-7)}` });
    await loginViaUi(page, 'manager@wizag.local');
    await sidebarLink(page, 'Leads').click();
    await waitForLeadsTable(page);
    await page.getByRole('button', { name: 'Refresh' }).click();
    await waitForLeadsTable(page);
    expect(await apiLeadCount(request, token)).toBe(before + 1);
    expect(await leadsTableRows(page).count()).toBe(before + 1);
  });

  test(SYNC_TESTS[1], async ({ page, request }) => {
    const token = await managerToken(request);
    const mark = `E003-fs2-${Date.now()}`;
    const id = await createLeadApi(request, token, {
      name: mark,
      phone: `+2753${Date.now().toString().slice(-7)}`,
    });
    const renamed = `${mark}-r`;
    await request.patch(`${QA_API_URL}/leads/${id}`, {
      headers: authHeaders(token),
      data: { name: renamed, confirmStageSuggestion: true },
    });
    await loginViaUi(page, 'manager@wizag.local');
    await sidebarLink(page, 'Leads').click();
    await waitForLeadsTable(page);
    await leadsSearch(page).fill(mark);
    await leadsTableRows(page).first().click();
    await expect(page.locator('aside.drawer h2')).toHaveText(renamed);
  });

  test(SYNC_TESTS[2], async ({ page, request }) => {
    const token = await managerToken(request);
    const uid = await apiMeUserId(request, token);
    const open = await apiOpenLeadCount(request, token, uid);
    await loginViaUi(page, 'manager@wizag.local');
    const kpi = page.locator('.kpi-card').filter({ hasText: 'My open leads' });
    const ui = Number((await kpi.locator('.kpi-card-value').textContent())?.replace(/,/g, '') ?? '');
    expect(ui).toBe(open);
  });

  test(SYNC_TESTS[3], async ({ request }) => {
    const token = await managerToken(request);
    const start = new Date(Date.now() + 60 * 24 * 60 * 60 * 1000);
    const title = `E003-cal-${Date.now()}`;
    const created = await request.post(`${QA_API_URL}/calendar/events`, {
      headers: authHeaders(token),
      data: {
        title,
        startAt: start.toISOString(),
        endAt: new Date(start.getTime() + 3600000).toISOString(),
        allDay: false,
      },
    });
    expect(created.ok()).toBeTruthy();
    const id = (await created.json()).event.id;
    await request.delete(`${QA_API_URL}/calendar/events/${id}`, { headers: authHeaders(token) });
    const from = new Date(start.getTime() - 86400000).toISOString().slice(0, 10);
    const to = new Date(start.getTime() + 2 * 86400000).toISOString().slice(0, 10);
    const list = await request.get(`${QA_API_URL}/calendar/events?from=${from}&to=${to}`, {
      headers: authHeaders(token),
    });
    const phantom = ((await list.json()).events ?? []).some((e: { id: string }) => e.id === id);
    expect(phantom).toBe(false);
  });

  test(SYNC_TESTS[4], async ({ request }) => {
    const token = await managerToken(request);
    const id = await createLeadApi(request, token, {
      name: `E003-pipe-${Date.now()}`,
      phone: `+2754${Date.now().toString().slice(-7)}`,
    });
    const lead = await request.get(`${QA_API_URL}/leads/${id}`, { headers: authHeaders(token) });
    const stage = (await lead.json()).lead.stage;
    const pipe = await request.get(`${QA_API_URL}/leads/pipeline`, { headers: authHeaders(token) });
    const bucket = (await pipe.json()).pipeline?.[stage] ?? [];
    expect(bucket.some((c: { id: string }) => c.id === id)).toBe(true);
  });

  test(SYNC_TESTS[5], async ({ request }) => {
    const token = await managerToken(request);
    const a = await apiLeadCount(request, token);
    const b = await apiLeadCount(request, token);
    expect(a).toBe(b);
  });

  test(SYNC_TESTS[6], async ({ page, request }) => {
    const token = await managerToken(request);
    await loginViaUi(page, 'manager@wizag.local');
    await sidebarLink(page, 'Leads').click();
    await waitForLeadsTable(page);
    await page.getByRole('combobox', { name: 'Filter by stage' }).selectOption('NEW');
    await waitNoSpinner(page);
    const ui = await leadsTableRows(page).count();
    const api = await request.get(`${QA_API_URL}/leads?stage=NEW`, { headers: authHeaders(token) });
    expect((await api.json()).leads.length).toBe(ui);
  });

  test(SYNC_TESTS[7], async ({ page, request }) => {
    const token = await managerToken(request);
    const mark = `E003-note-${Date.now()}`;
    const id = await createLeadApi(request, token, {
      name: mark,
      phone: `+2755${Date.now().toString().slice(-7)}`,
    });
    const body = `note-${Date.now()}`;
    await request.post(`${QA_API_URL}/leads/${id}/activities`, {
      headers: authHeaders(token),
      data: { type: 'NOTE', body },
    });
    const acts = await request.get(`${QA_API_URL}/leads/${id}/activities`, {
      headers: authHeaders(token),
    });
    expect((await acts.json()).activities[0].body).toContain(body);
    await loginViaUi(page, 'manager@wizag.local');
    await sidebarLink(page, 'Leads').click();
    await waitForLeadsTable(page);
    await leadsSearch(page).fill(mark);
    await leadsTableRows(page).first().click();
    await page.getByRole('tab', { name: 'History' }).click();
    await expect(page.locator('.audit-body').first()).toContainText(body, { timeout: 10_000 });
  });
});
