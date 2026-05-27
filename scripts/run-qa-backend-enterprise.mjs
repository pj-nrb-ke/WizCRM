#!/usr/bin/env node
/**
 * QA docs/QA/03-Backend-API-Database-QA.md + 04-Enterprise-State-Validation-QA.md
 * Hits live API (default https://api.wizcrm.app). Writes JSON for Excel report.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const baseUrl = (process.env.QA_API_URL ?? 'https://api.wizcrm.app').replace(/\/$/, '');
const password = process.env.QA_PASSWORD ?? 'wizcrm123';
const outFile =
  process.env.QA_BE_OUT ??
  path.join(root, 'docs', 'QA', 'results', 'qa-backend-enterprise.json');

const results = [];

function record(area, test, status, notes = '') {
  results.push({ area, test, status, notes: String(notes).slice(0, 500) });
  const tag = status === 'PASS' ? 'OK' : status === 'FAIL' ? 'FAIL' : status;
  console.log(`${tag} [${area}] ${test}${notes ? ` — ${notes}` : ''}`);
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
  let json = null;
  const text = await res.text();
  try {
    json = text ? JSON.parse(text) : null;
  } catch {
    json = { raw: text };
  }
  if (expectStatus !== undefined && res.status !== expectStatus) {
    throw new Error(`expected HTTP ${expectStatus}, got ${res.status}: ${text.slice(0, 200)}`);
  }
  return { status: res.status, json };
}

async function login(email) {
  const { status, json } = await api('POST', '/auth/login', {
    body: { email, password },
    expectStatus: 200,
  });
  if (!json?.token) throw new Error(`no token for ${email}`);
  return { token: json.token, user: json.user };
}

async function run() {
  console.log(`=== Backend + Enterprise QA ===\nAPI: ${baseUrl}\n`);

  let managerToken;
  let repToken;
  let managerUser;
  let repUser;

  try {
    const mgr = await login('manager@wizag.local');
    managerToken = mgr.token;
    managerUser = mgr.user;
    const rep = await login('rep@wizag.local');
    repToken = rep.token;
    repUser = rep.user;
  } catch (e) {
    record('Auth', 'Seed user login', 'FAIL', e.message);
    writeOut();
    process.exit(1);
  }

  // --- 03 Backend: status codes ---
  try {
    const h = await api('GET', '/health');
    if (h.status === 200 && h.json?.status === 'ok') {
      record('Backend', 'GET /health → 200 ok', 'PASS');
    } else record('Backend', 'GET /health → 200 ok', 'FAIL', `status=${h.status}`);
  } catch (e) {
    record('Backend', 'GET /health → 200 ok', 'FAIL', e.message);
  }

  try {
    await api('GET', '/leads', { expectStatus: 401 });
    record('Backend', 'GET /leads without token → 401', 'PASS');
  } catch (e) {
    record('Backend', 'GET /leads without token → 401', 'FAIL', e.message);
  }

  try {
    await api('GET', '/admin/users', { token: repToken, expectStatus: 403 });
    record('Backend', 'GET /admin/users as sales rep → 403', 'PASS');
  } catch (e) {
    record('Backend', 'GET /admin/users as sales rep → 403', 'FAIL', e.message);
  }

  try {
    await api('POST', '/auth/login', {
      body: { email: 'manager@wizag.local', password: 'wrong' },
      expectStatus: 401,
    });
    record('Backend', 'POST /auth/login bad password → 401', 'PASS');
  } catch (e) {
    record('Backend', 'POST /auth/login bad password → 401', 'FAIL', e.message);
  }

  try {
    await api('POST', '/auth/register', {
      body: { email: 'qa-hack@test.local', password: 'x' },
      expectStatus: 404,
    });
    record('Backend', 'POST /auth/register → 404 (no public signup)', 'PASS');
  } catch (e) {
    record('Backend', 'POST /auth/register → 404 (no public signup)', 'FAIL', e.message);
  }

  // --- 03: duplicate prevention ---
  const dupPhone = `+2782${Date.now().toString().slice(-7)}`;
  let dupLeadId;
  try {
    const c1 = await api('POST', '/leads', {
      token: repToken,
      body: { name: 'QA Dup A', phone: dupPhone },
      expectStatus: 201,
    });
    dupLeadId = c1.json?.lead?.id;
    await api('POST', '/leads', {
      token: repToken,
      body: { name: 'QA Dup B', phone: dupPhone },
      expectStatus: 409,
    });
    record('Backend', 'POST /leads duplicate phone → 409', 'PASS');
  } catch (e) {
    record('Backend', 'POST /leads duplicate phone → 409', 'FAIL', e.message);
  }

  // --- 03: business rule rollback — WON without deal value → 400 ---
  let stageLeadId;
  try {
    const created = await api('POST', '/leads', {
      token: repToken,
      body: {
        name: 'QA Stage',
        email: `qa-stage-${Date.now()}@test.local`,
      },
      expectStatus: 201,
    });
    stageLeadId = created.json?.lead?.id;
    await api('PATCH', `/leads/${stageLeadId}`, {
      token: repToken,
      body: { stage: 'WON' },
      expectStatus: 400,
    });
    record('Backend', 'PATCH stage WON without wonValue → 400', 'PASS');
  } catch (e) {
    record('Backend', 'PATCH stage WON without wonValue → 400', 'FAIL', e.message);
  }

  // --- 03/04: calendar rollback (no phantom after DELETE) ---
  let eventId;
  try {
    const start = new Date(Date.now() + 45 * 24 * 60 * 60 * 1000);
    start.setUTCHours(14, 0, 0, 0);
    const end = new Date(start.getTime() + 3600000);
    const title = `QA rollback ${Date.now()}`;
    const created = await api('POST', '/calendar/events', {
      token: managerToken,
      body: {
        title,
        startAt: start.toISOString(),
        endAt: end.toISOString(),
        allDay: false,
      },
      expectStatus: 201,
    });
    eventId = created.json?.event?.id;
    const from = new Date(start.getTime() - 86400000).toISOString().slice(0, 10);
    const to = new Date(start.getTime() + 2 * 86400000).toISOString().slice(0, 10);
    await api('DELETE', `/calendar/events/${eventId}`, { token: managerToken, expectStatus: 200 });
    const after = await api('GET', `/calendar/events?from=${from}&to=${to}`, {
      token: managerToken,
      expectStatus: 200,
    });
    const phantom = (after.json?.events ?? []).some((e) => e.id === eventId);
    if (phantom) throw new Error('event still listed after DELETE');
    record('Backend', 'Calendar DELETE rollback — event removed from GET', 'PASS');
    eventId = null;
  } catch (e) {
    record('Backend', 'Calendar DELETE rollback — event removed from GET', 'FAIL', e.message);
  } finally {
    if (eventId) {
      try {
        await api('DELETE', `/calendar/events/${eventId}`, { token: managerToken });
      } catch {
        /* cleanup */
      }
    }
  }

  // --- 04: no stale state (PATCH then GET) ---
  let syncLeadId;
  const syncPhone = `+2783${Date.now().toString().slice(-7)}`;
  const updatedName = `QA Sync ${Date.now()}`;
  try {
    const created = await api('POST', '/leads', {
      token: repToken,
      body: { name: 'QA Before Sync', phone: syncPhone },
      expectStatus: 201,
    });
    syncLeadId = created.json?.lead?.id;
    await api('PATCH', `/leads/${syncLeadId}`, {
      token: repToken,
      body: { name: updatedName, confirmStageSuggestion: true },
      expectStatus: 200,
    });
    const got = await api('GET', `/leads/${syncLeadId}`, { token: repToken, expectStatus: 200 });
    if (got.json?.lead?.name !== updatedName) {
      throw new Error(`stale name: ${got.json?.lead?.name}`);
    }
    record('Enterprise State', 'PATCH lead name then GET — no stale state', 'PASS');
  } catch (e) {
    record('Enterprise State', 'PATCH lead name then GET — no stale state', 'FAIL', e.message);
  }

  // --- 04: list sync after create ---
  try {
    const list = await api('GET', '/leads', { token: managerToken, expectStatus: 200 });
    const found = (list.json?.leads ?? []).some((l) => l.id === syncLeadId);
    if (!found) throw new Error('new lead missing from GET /leads');
    record('Enterprise State', 'New lead visible in GET /leads (list sync)', 'PASS');
  } catch (e) {
    record('Enterprise State', 'New lead visible in GET /leads (list sync)', 'FAIL', e.message);
  }

  // --- 04: no duplicate creation (same as 409, enterprise framing) ---
  try {
    await api('POST', '/leads', {
      token: repToken,
      body: { name: 'QA Dup C', phone: dupPhone },
      expectStatus: 409,
    });
    record('Enterprise State', 'Duplicate create blocked — no second row', 'PASS');
  } catch (e) {
    record('Enterprise State', 'Duplicate create blocked — no second row', 'FAIL', e.message);
  }

  // --- 04: dashboard counters sync ---
  try {
    const summary = await api('GET', '/reports/summary', {
      token: managerToken,
      expectStatus: 200,
    });
    const leads = await api('GET', '/leads', { token: managerToken, expectStatus: 200 });
    const openFromList = (leads.json?.leads ?? []).filter(
      (l) => l.stage !== 'WON' && l.stage !== 'LOST',
    ).length;
    const openFromSummary = summary.json?.summary?.openLeads;
    if (typeof openFromSummary !== 'number') {
      throw new Error('summary.openLeads missing');
    }
    if (openFromList !== openFromSummary) {
      throw new Error(`openLeads mismatch list=${openFromList} summary=${openFromSummary}`);
    }
    record('Enterprise State', 'openLeads: /leads count matches /reports/summary', 'PASS');
  } catch (e) {
    record('Enterprise State', 'openLeads: /leads count matches /reports/summary', 'FAIL', e.message);
  }

  // --- 04: pipeline stage consistency ---
  try {
    const pipe = await api('GET', '/leads/pipeline', {
      token: managerToken,
      expectStatus: 200,
    });
    const lead = await api('GET', `/leads/${syncLeadId}`, {
      token: managerToken,
      expectStatus: 200,
    });
    const stage = lead.json?.lead?.stage;
    const bucket = pipe.json?.pipeline?.[stage] ?? [];
    const inPipeline = bucket.some((c) => c.id === syncLeadId);
    if (!inPipeline && stage !== 'WON' && stage !== 'LOST') {
      throw new Error(`lead ${syncLeadId} stage ${stage} not in pipeline bucket`);
    }
    record('Enterprise State', 'Pipeline bucket contains lead for current stage', 'PASS');
  } catch (e) {
    record('Enterprise State', 'Pipeline bucket contains lead for current stage', 'FAIL', e.message);
  }

  // --- 03: frontend/backend sync (manager leads count stable after refresh) ---
  try {
    const a = await api('GET', '/leads', { token: managerToken, expectStatus: 200 });
    const b = await api('GET', '/leads', { token: managerToken, expectStatus: 200 });
    if ((a.json?.leads ?? []).length !== (b.json?.leads ?? []).length) {
      throw new Error('consecutive GET /leads length differ');
    }
    record('Backend', 'Consecutive GET /leads — stable list length', 'PASS');
  } catch (e) {
    record('Backend', 'Consecutive GET /leads — stable list length', 'FAIL', e.message);
  }

  // --- 03: production smoke subset ---
  const smokeChecks = [
    ['GET /teams', '/teams'],
    ['GET /reports/analytics', '/reports/analytics'],
    ['GET /teams/activity-feed', '/teams/activity-feed?dateFrom=2020-01-01&dateTo=2030-12-31'],
  ];
  for (const [label, pathSuffix] of smokeChecks) {
    try {
      const r = await api('GET', pathSuffix, { token: managerToken, expectStatus: 200 });
      if (r.json === null) throw new Error('empty body');
      record('Backend', `${label} → 200`, 'PASS');
    } catch (e) {
      record('Backend', `${label} → 200`, 'FAIL', e.message);
    }
  }

  writeOut();
  const failed = results.filter((r) => r.status === 'FAIL').length;
  console.log(`\n=== Done: ${results.length - failed}/${results.length} passed ===`);
  process.exit(failed > 0 ? 1 : 0);
}

function writeOut() {
  const payload = {
    ranAt: new Date().toISOString(),
    apiUrl: baseUrl,
    docs: ['03-Backend-API-Database-QA', '04-Enterprise-State-Validation-QA'],
    results,
  };
  fs.mkdirSync(path.dirname(outFile), { recursive: true });
  fs.writeFileSync(outFile, JSON.stringify(payload, null, 2), 'utf8');
  console.log(`\nWrote ${outFile}`);
}

run().catch((e) => {
  console.error(e);
  record('Runner', 'Unhandled error', 'FAIL', e.message);
  writeOut();
  process.exit(1);
});
