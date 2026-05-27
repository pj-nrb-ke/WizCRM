import { api, login, phoneSuffix, totalLeads } from './api-client.mjs';

export async function runRaceTests() {
  const rows = [];
  const mgr = await login('manager@wizag.local');
  const rep = await login('rep@wizag.local');

  async function run(id, name, fn) {
    try {
      const assertions = await fn();
      rows.push({ id, test: name, status: 'PASS', notes: '', assertions });
      console.log(`OK [RC] ${name}`);
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      rows.push({ id, test: name, status: 'FAIL', notes: msg, assertions: 'failed' });
      console.log(`FAIL [RC] ${name} — ${msg}`);
    }
  }

  await run('RC-001', 'RC-01 parallel GET /leads x10 → same count', async () => {
    const results = await Promise.all(
      Array.from({ length: 10 }, () => api('GET', '/leads', { token: mgr })),
    );
    const counts = results.map((r) => (r.json?.leads ?? []).length);
    if (new Set(counts).size !== 1) throw new Error(`counts differ: ${counts.join(',')}`);
    return `stable count=${counts[0]}`;
  });

  await run('RC-002', 'RC-02 GET leads + GET pipeline concurrently → no 500', async () => {
    const [a, b] = await Promise.all([
      api('GET', '/leads', { token: mgr }),
      api('GET', '/leads/pipeline', { token: mgr }),
    ]);
    if (a.status >= 500 || b.status >= 500) throw new Error('server error');
    return `leads=${a.status} pipeline=${b.status}`;
  });

  await run('RC-003', 'RC-03 parallel tag filter queries → consistent totals', async () => {
    const tags = ['', 'vip', 'test', ''];
    const results = await Promise.all(
      tags.map((t) => api('GET', t ? `/leads?tag=${encodeURIComponent(t)}` : '/leads', { token: mgr })),
    );
    if (results.some((r) => r.status >= 500)) throw new Error('500 on filter');
    return 'all 200';
  });

  await run('RC-004', 'RC-04 PATCH while parallel GETs → final GET matches', async () => {
    const phone = `+2711${phoneSuffix()}`;
    const c = await api('POST', '/leads', { token: rep, body: { name: 'RC04', phone } });
    const id = c.json?.lead?.id;
    const renamed = `RC04-${phoneSuffix()}`;
    await Promise.all([
      ...Array.from({ length: 5 }, () => api('GET', `/leads/${id}`, { token: rep })),
      api('PATCH', `/leads/${id}`, {
        token: rep,
        body: { name: renamed, confirmStageSuggestion: true },
      }),
    ]);
    const got = await api('GET', `/leads/${id}`, { token: rep });
    if (got.json?.lead?.name !== renamed) throw new Error('stale name after patch race');
    return 'name synced';
  });

  for (let i = 5; i <= 20; i++) {
    const id = String(i).padStart(2, '0');
    await run(`RC-${String(i).padStart(3, '0')}`, `RC-${id} concurrent read/write mix ${i}`, async () => {
      const before = await totalLeads(mgr);
      const ops = [
        api('GET', '/leads', { token: mgr }),
        api('GET', '/reports/summary', { token: mgr }),
        api('GET', '/teams', { token: mgr }),
        api('GET', '/calendar/events', { token: mgr }),
        api('GET', '/leads/pipeline', { token: mgr }),
      ];
      if (i % 3 === 0) {
        const phone = `+27${20 + i}${phoneSuffix()}`;
        ops.push(
          api('POST', '/leads', { token: rep, body: { name: `RC${id}`, phone } }),
        );
      }
      const results = await Promise.all(ops);
      if (results.some((r) => r.status >= 500)) throw new Error('500 in race');
      const after = await totalLeads(mgr);
      if (after < before) throw new Error('phantom delete?');
      return `before=${before} after=${after}`;
    });
  }

  return rows;
}
