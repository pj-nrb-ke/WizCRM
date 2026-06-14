import { api, login, phoneSuffix, countLeadsWithPhone, totalLeads } from './api-client.mjs';

/** @returns {Promise<{ test: string, status: string, notes: string, assertions: string }[]>} */
export async function runDuplicateTests() {
  const rows = [];
  const rep = await login('rep@wizag.local');
  const rep2 = await login('rep2@wizag.local');
  const mgr = await login('manager@wizag.local');

  async function run(id, name, fn) {
    try {
      const assertions = await fn();
      rows.push({ id, test: name, status: 'PASS', notes: '', assertions });
      console.log(`OK [DP] ${name}`);
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      rows.push({ id, test: name, status: 'FAIL', notes: msg, assertions: 'failed' });
      console.log(`FAIL [DP] ${name} — ${msg}`);
    }
  }

  await run('DP-001', 'DP-01 parallel double POST same phone → ≤1 row', async () => {
    const phone = `+2703${phoneSuffix()}`;
    await Promise.all([
      api('POST', '/leads', { token: rep, body: { name: 'DP01a', phone } }),
      api('POST', '/leads', { token: rep, body: { name: 'DP01b', phone } }),
    ]);
    const n = await countLeadsWithPhone(rep, phone);
    if (n > 1) throw new Error(`duplicate rows: ${n}`);
    return `phone rows=${n}`;
  });

  await run('DP-002', 'DP-02 sequential duplicate phone → 409', async () => {
    const phone = `+2704${phoneSuffix()}`;
    const a = await api('POST', '/leads', { token: rep, body: { name: 'DP02a', phone } });
    if (a.status !== 201) throw new Error(`first ${a.status}`);
    const b = await api('POST', '/leads', { token: rep, body: { name: 'DP02b', phone } });
    if (b.status !== 409) throw new Error(`expected 409 got ${b.status}`);
    return '409 on second create';
  });

  await run('DP-003', 'DP-03 triple burst same phone → ≤1 row', async () => {
    const phone = `+2705${phoneSuffix()}`;
    await Promise.all(
      [1, 2, 3].map((i) =>
        api('POST', '/leads', { token: rep, body: { name: `DP03-${i}`, phone } }),
      ),
    );
    const n = await countLeadsWithPhone(rep, phone);
    if (n > 1) throw new Error(`rows=${n}`);
    return `rows=${n}`;
  });

  await run('DP-004', 'DP-04 parallel duplicate email → ≤1 row', async () => {
    const email = `dp04-${phoneSuffix()}@test.local`;
    await Promise.all([
      api('POST', '/leads', { token: rep, body: { name: 'DP04a', email } }),
      api('POST', '/leads', { token: rep, body: { name: 'DP04b', email } }),
    ]);
    const r = await api('GET', '/leads', { token: rep });
    const n = (r.json?.leads ?? []).filter((l) => l.email === email).length;
    if (n > 1) throw new Error(`email dup rows=${n}`);
    return `email rows=${n}`;
  });

  await run('DP-005', 'DP-05 two reps same phone concurrently → ≤1 row org-wide', async () => {
    const phone = `+2706${phoneSuffix()}`;
    await Promise.all([
      api('POST', '/leads', { token: rep, body: { name: 'DP05a', phone } }),
      api('POST', '/leads', { token: rep2, body: { name: 'DP05b', phone } }),
    ]);
    const n = await countLeadsWithPhone(mgr, phone);
    if (n > 1) throw new Error(`org rows=${n}`);
    return `org rows=${n}`;
  });

  for (let i = 6; i <= 25; i++) {
    const id = String(i).padStart(2, '0');
    await run(`DP-${String(i).padStart(3, '0')}`, `DP-${id} burst-${i % 5} concurrent creates same phone`, async () => {
      const phone = `+27${10 + (i % 80)}${phoneSuffix()}`;
      const burst = 2 + (i % 4);
      const results = await Promise.all(
        Array.from({ length: burst }, (_, j) =>
          api('POST', '/leads', {
            token: i % 2 === 0 ? rep : rep2,
            body: { name: `DP${id}-${j}`, phone },
          }),
        ),
      );
      const created = results.filter((r) => r.status === 201).length;
      const dup = results.filter((r) => r.status === 409).length;
      const n = await countLeadsWithPhone(mgr, phone);
      if (n > 1) throw new Error(`rows=${n} created=${created} dup=${dup}`);
      if (created === 0 && dup === 0) throw new Error('no 201 or 409');
      return `rows=${n} 201=${created} 409=${dup}`;
    });
  }

  return rows;
}
