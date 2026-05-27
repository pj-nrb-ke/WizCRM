import { QA_API_URL } from './constants.mjs';

export const baseUrl = (process.env.QA_API_URL ?? QA_API_URL).replace(/\/$/, '');
export const password = process.env.QA_PASSWORD ?? 'wizcrm123';

export async function api(method, pathSuffix, { token, body, timeoutMs = 20_000 } = {}) {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), timeoutMs);
  const headers = { Accept: 'application/json' };
  if (token) headers.Authorization = `Bearer ${token}`;
  if (body !== undefined) headers['Content-Type'] = 'application/json';
  try {
    const res = await fetch(`${baseUrl}${pathSuffix}`, {
      method,
      headers,
      body: body !== undefined ? JSON.stringify(body) : undefined,
      signal: ctrl.signal,
    });
    const text = await res.text();
    let json = null;
    try {
      json = text ? JSON.parse(text) : null;
    } catch {
      json = { raw: text };
    }
    return { status: res.status, json, text };
  } finally {
    clearTimeout(timer);
  }
}

export async function login(email) {
  const r = await api('POST', '/auth/login', { body: { email, password } });
  if (r.status !== 200 || !r.json?.token) throw new Error(`login failed ${email}: ${r.status}`);
  return r.json.token;
}

export function phoneSuffix() {
  return Date.now().toString().slice(-7) + Math.floor(Math.random() * 9);
}

export async function countLeadsWithPhone(token, phone) {
  const r = await api('GET', '/leads', { token });
  const leads = r.json?.leads ?? [];
  return leads.filter((l) => l.phone === phone).length;
}

export async function totalLeads(token) {
  const r = await api('GET', '/leads', { token });
  return (r.json?.leads ?? []).length;
}
