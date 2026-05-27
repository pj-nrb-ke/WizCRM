import { test, expect } from '@playwright/test';

const MOBILE_VIEWPORT = { width: 390, height: 844 };
import { loginViaUi, sidebarLink, waitForLeadsTable, getToken, authHeaders, QA_API_URL } from './helpers';

const XSS_MARK = 'qa-xss-05';
const XSS_BODY = `<script>alert("${XSS_MARK}")</script>`;

test.describe('Security — XSS in UI', () => {
  test('timeline renders stored markup without executing script', async ({ page, request }) => {
    const token = await getToken(request, 'manager@wizag.local');
    const phone = `+2775${Date.now().toString().slice(-7)}`;
    const create = await request.post(`${QA_API_URL}/leads`, {
      headers: authHeaders(token),
      data: { name: `QA XSS ${XSS_MARK}`, phone },
    });
    expect(create.ok()).toBeTruthy();
    const leadId = (await create.json()).lead.id as string;
    const note = await request.post(`${QA_API_URL}/leads/${leadId}/activities`, {
      headers: authHeaders(token),
      data: { type: 'NOTE', body: XSS_BODY },
    });
    expect(note.ok()).toBeTruthy();

    let dialogFired = false;
    page.on('dialog', () => {
      dialogFired = true;
    });

    await loginViaUi(page, 'manager@wizag.local');
    await sidebarLink(page, 'Leads').click();
    await waitForLeadsTable(page);
    await page.getByRole('button', { name: 'Refresh' }).click();
    await waitForLeadsTable(page);
    await page.getByRole('searchbox', { name: 'Search leads' }).fill(XSS_MARK);
    const row = page.locator('table tbody tr').filter({ hasText: XSS_MARK }).first();
    await expect(row).toBeVisible({ timeout: 15_000 });
    await row.click();
    await expect(page.locator('.drawer-tabs')).toBeVisible({ timeout: 10_000 });
    await page.getByRole('tab', { name: 'History' }).click();
    await page.waitForTimeout(800);
    expect(dialogFired).toBe(false);
    const executors = await page.locator('script').evaluateAll((nodes) =>
      nodes.map((n) => (n as HTMLScriptElement).textContent ?? ''),
    );
    const ranInline = executors.some((t) => t.includes(XSS_MARK));
    expect(ranInline).toBe(false);
  });
});

test.describe('Performance — browser', () => {
  test.beforeEach(async ({ page }) => {
    await loginViaUi(page, 'manager@wizag.local');
  });

  test('leads page loads within 15s', async ({ page }) => {
    const start = Date.now();
    await sidebarLink(page, 'Leads').click();
    await waitForLeadsTable(page);
    expect(Date.now() - start).toBeLessThan(15_000);
  });

  test('rapid navigation — no error banner (browser lag)', async ({ page }) => {
    const links = ['Overview', 'Leads', 'Pipeline', 'Reports', 'Overview'];
    for (let round = 0; round < 4; round++) {
      for (const name of links) {
        const t0 = Date.now();
        await sidebarLink(page, name).click({ timeout: 10_000 });
        expect(Date.now() - t0).toBeLessThan(10_000);
      }
    }
    await expect(page.locator('.alert-error')).toHaveCount(0);
  });

  test('long session — 20 navigations under 2 minutes', async ({ page }) => {
    const t0 = Date.now();
    for (let i = 0; i < 20; i++) {
      await sidebarLink(page, i % 2 === 0 ? 'Leads' : 'Overview').click();
    }
    expect(Date.now() - t0).toBeLessThan(120_000);
    await expect(page.locator('.app-shell')).toBeVisible();
  });

  test('JS heap growth bounded after repeated navigations', async ({ page, browserName }) => {
    test.skip(browserName !== 'chromium', 'memory API chromium-only');
    await sidebarLink(page, 'Overview').click();
    const heapBefore = await page.evaluate(() =>
      (performance as Performance & { memory?: { usedJSHeapSize: number } }).memory?.usedJSHeapSize ?? 0,
    );
    for (let i = 0; i < 12; i++) {
      await sidebarLink(page, 'Leads').click();
      await sidebarLink(page, 'Overview').click();
    }
    const heapAfter = await page.evaluate(() =>
      (performance as Performance & { memory?: { usedJSHeapSize: number } }).memory?.usedJSHeapSize ?? 0,
    );
    if (heapBefore > 0 && heapAfter > 0) {
      const growthMb = (heapAfter - heapBefore) / (1024 * 1024);
      expect(growthMb).toBeLessThan(80);
    }
  });
});

test.describe('Mobile responsiveness', () => {
  test('mobile viewport login and overview', async ({ page }) => {
    await page.setViewportSize(MOBILE_VIEWPORT);
    await loginViaUi(page, 'manager@wizag.local');
    await expect(page.getByLabel('My personal dashboard')).toBeVisible({ timeout: 20_000 });
  });

  test('mobile viewport leads table visible', async ({ page }) => {
    await page.setViewportSize(MOBILE_VIEWPORT);
    await loginViaUi(page, 'manager@wizag.local');
    await sidebarLink(page, 'Leads').click();
    await waitForLeadsTable(page);
    await expect(page.locator('table')).toBeVisible();
    const main = page.locator('.main');
    const box = await main.boundingBox();
    expect(box?.width ?? 0).toBeLessThanOrEqual(420);
  });
});
