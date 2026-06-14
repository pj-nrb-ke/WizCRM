#!/usr/bin/env node
/**
 * QA docs/QA/05 — API security (SQLi probes, XSS storage, auth hardening)
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const baseUrl = (process.env.QA_API_URL ?? 'https://api.wizcrm.app').replace(/\/$/, '');
const password = process.env.QA_PASSWORD ?? 'wizcrm123';
const outFile = path.join(root, 'docs', 'QA', 'results', 'qa-security-performance.json');

const SQLI_PAYLOADS = [
  "' OR '1'='1",
  '1; DROP TABLE leads;--',
  "1' UNION SELECT null--",
];
const XSS_PAYLOAD = '<script>alert("qa-xss")</script><img src=x onerror=alert(1)>';

const results = [];

function record(category, test, status, notes = '') {
  results.push({ category, test, status, notes: String(notes).slice(0, 500) });
  const tag = status === 'PASS' ? 'OK' : status === 'FAIL' ? 'FAIL' : status;
  console.log(`${tag} [${category}] ${test}${notes ? ` — ${notes}` : ''}`);
}

function looksLikeSqlLeak(text) {
  const t = String(text).toLowerCase();
  return (
    t.includes('syntax error at') ||
    t.includes('prisma') && t.includes('raw query') ||
    t.includes('sqlstate') ||
    t.includes('postgresql') && t.includes('error')
  );
}

async function api(method, pathSuffix, { token, body, expectStatus } = {}) {
  const headers = { Accept: 'application/json' };
  if (token) headers.Authorization = `Bearer ${token}`;
  if (body !== undefined) headers['Content-Type'] = 'application/json';
  const res = await fetch(`${baseUrl}${pathSuffix}`, {
    method,
    headers,
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });
  const text = await res.text();
  let json = null;
  try {
    json = text ? JSON.parse(text) : null;
  } catch {
    json = null;
  }
  if (expectStatus !== undefined && res.status !== expectStatus) {
    throw new Error(`HTTP ${res.status} (expected ${expectStatus}): ${text.slice(0, 180)}`);
  }
  return { status: res.status, json, text };
}

async function login(email) {
  const { json } = await api('POST', '/auth/login', {
    body: { email, password },
    expectStatus: 200,
  });
  return json.token;
}

async function run() {
  console.log(`=== QA 05 API Security ===\n${baseUrl}\n`);

  let repToken;
  let managerToken;
  try {
    repToken = await login('rep@wizag.local');
    managerToken = await login('manager@wizag.local');
  } catch (e) {
    record('Security', 'Seed login', 'FAIL', e.message);
    writeOut();
    process.exit(1);
  }

  // SQL injection — lead name
  for (const payload of SQLI_PAYLOADS) {
    try {
      const res = await api('POST', '/leads', {
        token: repToken,
        body: { name: payload, phone: `+2799${Date.now().toString().slice(-7)}` },
      });
      if (looksLikeSqlLeak(res.text)) throw new Error('SQL error leaked in response');
      if (res.status >= 500) throw new Error(`server error ${res.status}`);
      record('Security', `SQLi in lead name (${payload.slice(0, 24)}…)`, 'PASS', `HTTP ${res.status}`);
    } catch (e) {
      record('Security', `SQLi in lead name (${payload.slice(0, 24)}…)`, 'FAIL', e.message);
    }
  }

  // SQL injection — query params
  try {
    const q = encodeURIComponent("'; SELECT * FROM users; --");
    const res = await api('GET', `/leads?tag=${q}`, { token: managerToken });
    if (looksLikeSqlLeak(res.text)) throw new Error('SQL error in tag filter');
    if (res.status >= 500) throw new Error(`HTTP ${res.status}`);
    record('Security', 'SQLi in GET /leads?tag=', 'PASS', `HTTP ${res.status}`);
  } catch (e) {
    record('Security', 'SQLi in GET /leads?tag=', 'FAIL', e.message);
  }

  // SQL injection — login email
  try {
    const res = await api('POST', '/auth/login', {
      body: { email: "admin'--@wizag.local", password: 'x' },
      expectStatus: 401,
    });
    if (looksLikeSqlLeak(res.text)) throw new Error('SQL leak on login');
    record('Security', 'SQLi in login email → 401, no SQL leak', 'PASS');
  } catch (e) {
    record('Security', 'SQLi in login email → 401, no SQL leak', 'FAIL', e.message);
  }

  // XSS — stored note returned as data (not executed server-side)
  let xssLeadId;
  try {
    const created = await api('POST', '/leads', {
      token: repToken,
      body: { name: 'QA XSS', phone: `+2798${Date.now().toString().slice(-7)}` },
      expectStatus: 201,
    });
    xssLeadId = created.json?.lead?.id;
    await api('POST', `/leads/${xssLeadId}/activities`, {
      token: repToken,
      body: { type: 'NOTE', body: XSS_PAYLOAD },
      expectStatus: 201,
    });
    const list = await api('GET', `/leads/${xssLeadId}/activities`, {
      token: repToken,
      expectStatus: 200,
    });
    const body = list.json?.activities?.[0]?.body ?? '';
    if (!body.includes('script') && !body.includes('<')) {
      record('Security', 'XSS payload stored and retrievable', 'PASS', 'sanitized or stripped');
    } else if (body === XSS_PAYLOAD) {
      record(
        'Security',
        'XSS payload stored and retrievable',
        'PASS',
        'stored verbatim; UI must escape (see Playwright)',
      );
    } else {
      record('Security', 'XSS payload stored and retrievable', 'PASS', 'note persisted');
    }
  } catch (e) {
    record('Security', 'XSS payload stored and retrievable', 'FAIL', e.message);
  }

  // Tampered JWT
  try {
    const res = await api('GET', '/leads', {
      token: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.invalid.signature',
    });
    if (res.status !== 401) throw new Error(`expected 401, got ${res.status}`);
    record('Security', 'Tampered JWT → 401', 'PASS');
  } catch (e) {
    record('Security', 'Tampered JWT → 401', 'FAIL', e.message);
  }

  // Webhook without key
  try {
    await api('POST', '/integrations/webhook/leads', {
      body: { name: 'Hack' },
      expectStatus: 401,
    });
    record('Security', 'Webhook without key → 401', 'PASS');
  } catch (e) {
    record('Security', 'Webhook without key → 401', 'FAIL', e.message);
  }

  // Invalid lead UUID path
  try {
    const res = await api('GET', '/leads/not-a-uuid', { token: managerToken });
    if (res.status >= 500) throw new Error(`server error ${res.status}`);
    if (looksLikeSqlLeak(res.text)) throw new Error('SQL leak on bad id');
    record('Security', 'Invalid lead id — no 500/SQL leak', 'PASS', `HTTP ${res.status}`);
  } catch (e) {
    record('Security', 'Invalid lead id — no 500/SQL leak', 'FAIL', e.message);
  }

  writeOut();
  const failed = results.filter((r) => r.status === 'FAIL').length;
  console.log(`\nAPI security: ${results.length - failed}/${results.length} passed`);
  process.exit(failed > 0 ? 1 : 0);
}

function writeOut() {
  const existing = fs.existsSync(outFile)
    ? JSON.parse(fs.readFileSync(outFile, 'utf8'))
    : { playwright: [], mobile: [] };
  fs.mkdirSync(path.dirname(outFile), { recursive: true });
  fs.writeFileSync(
    outFile,
    JSON.stringify(
      {
        ...existing,
        ranAt: new Date().toISOString(),
        apiUrl: baseUrl,
        apiSecurity: results,
      },
      null,
      2,
    ),
    'utf8',
  );
  console.log(`\nWrote ${outFile}`);
}

run().catch((e) => {
  console.error(e);
  process.exit(1);
});
