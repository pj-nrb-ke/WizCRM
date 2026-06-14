import { expect, type APIRequestContext, type Page } from '@playwright/test';
import { QA_API_URL, authHeaders, getToken } from './helpers';

export type ConsoleEntry = { type: string; text: string };

export function attachConsoleCollector(page: Page): ConsoleEntry[] {
  const logs: ConsoleEntry[] = [];
  page.on('console', (msg) => {
    if (msg.type() === 'error' || msg.type() === 'warning') {
      logs.push({ type: msg.type(), text: msg.text() });
    }
  });
  page.on('pageerror', (err) => {
    logs.push({ type: 'pageerror', text: err.message });
  });
  return logs;
}

export function assertNoSevereConsole(logs: ConsoleEntry[]): void {
  const severe = logs.filter(
    (l) =>
      l.type === 'pageerror' ||
      (l.type === 'error' && !l.text.includes('favicon') && !l.text.includes('404')),
  );
  expect(severe, `console errors: ${severe.map((s) => s.text).join('; ')}`).toHaveLength(0);
}

export async function apiLeadCount(request: APIRequestContext, token: string): Promise<number> {
  const res = await request.get(`${QA_API_URL}/leads`, { headers: authHeaders(token) });
  expect(res.ok()).toBeTruthy();
  const body = (await res.json()) as { leads: unknown[] };
  return body.leads?.length ?? 0;
}

export async function apiOpenLeadCount(
  request: APIRequestContext,
  token: string,
  ownerId?: string,
): Promise<number> {
  const qs = ownerId ? `?ownerId=${encodeURIComponent(ownerId)}` : '';
  const res = await request.get(`${QA_API_URL}/leads${qs}`, { headers: authHeaders(token) });
  const body = (await res.json()) as { leads: { stage: string }[] };
  return (body.leads ?? []).filter((l) => l.stage !== 'WON' && l.stage !== 'LOST').length;
}

export async function apiMeUserId(request: APIRequestContext, token: string): Promise<string> {
  const res = await request.get(`${QA_API_URL}/auth/me`, { headers: authHeaders(token) });
  expect(res.ok()).toBeTruthy();
  const body = (await res.json()) as { user: { id: string } };
  return body.user.id;
}

export async function apiSummaryOpen(request: APIRequestContext, token: string): Promise<number> {
  const res = await request.get(`${QA_API_URL}/reports/summary`, { headers: authHeaders(token) });
  expect(res.ok()).toBeTruthy();
  const body = (await res.json()) as { summary: { openLeads: number } };
  return body.summary.openLeads;
}

export async function createLeadApi(
  request: APIRequestContext,
  token: string,
  data: { name: string; phone: string },
): Promise<string> {
  const res = await request.post(`${QA_API_URL}/leads`, {
    headers: authHeaders(token),
    data,
  });
  expect(res.status()).toBe(201);
  const body = (await res.json()) as { lead: { id: string } };
  return body.lead.id;
}

export async function managerToken(request: APIRequestContext): Promise<string> {
  return getToken(request, 'manager@wizag.local');
}

export async function waitNoSpinner(page: Page, maxMs = 15_000): Promise<void> {
  await expect(page.getByText('Loading…')).toHaveCount(0, { timeout: maxMs });
}
