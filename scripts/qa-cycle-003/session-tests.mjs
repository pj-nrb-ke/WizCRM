import { api, login, phoneSuffix } from './api-client.mjs';

export async function runSessionTests() {
  const rows = [];
  const mgr = await login('manager@wizag.local');

  async function run(id, name, fn) {
    try {
      const assertions = await fn();
      rows.push({ id, test: name, status: 'PASS', notes: '', assertions });
      console.log(`OK [SR] ${name}`);
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      rows.push({ id, test: name, status: 'FAIL', notes: msg, assertions: 'failed' });
      console.log(`FAIL [SR] ${name} — ${msg}`);
    }
  }

  await run('SR-001', 'SR-01 no token → 401', async () => {
    const r = await api('GET', '/leads');
    if (r.status !== 401) throw new Error(`got ${r.status}`);
    return '401';
  });

  await run('SR-002', 'SR-02 tampered JWT → 401', async () => {
    const r = await api('GET', '/leads', { token: 'eyJhbGciOiJIUzI1NiJ9.bad.sig' });
    if (r.status !== 401) throw new Error(`got ${r.status}`);
    return '401';
  });

  await run('SR-003', 'SR-03 bad password → 401', async () => {
    const r = await api('POST', '/auth/login', {
      body: { email: 'manager@wizag.local', password: 'wrong' },
    });
    if (r.status !== 401) throw new Error(`got ${r.status}`);
    return '401';
  });

  await run('SR-004', 'SR-04 valid login → token + /auth/me', async () => {
    const token = await login('manager@wizag.local');
    const me = await api('GET', '/auth/me', { token });
    if (me.status !== 200 || !me.json?.user?.id) throw new Error('me failed');
    return `user=${me.json.user.email}`;
  });

  for (let i = 5; i <= 20; i++) {
    const id = String(i).padStart(2, '0');
    await run(`SR-${String(i).padStart(3, '0')}`, `SR-${id} re-login cycle ${i}`, async () => {
      const token = await login(i % 2 === 0 ? 'rep@wizag.local' : 'manager@wizag.local');
      const leads = await api('GET', '/leads', { token });
      if (leads.status !== 200) throw new Error(`leads ${leads.status}`);
      const token2 = await login('manager@wizag.local');
      const me = await api('GET', '/auth/me', { token: token2 });
      if (me.status !== 200) throw new Error('re-login failed');
      if (i % 4 === 0) {
        const phone = `+28${i}${phoneSuffix()}`;
        const c = await api('POST', '/leads', {
          token: token2,
          body: { name: `SR${id}`, phone },
        });
        if (c.status !== 201) throw new Error(`create ${c.status}`);
        const got = await api('GET', `/leads/${c.json.lead.id}`, { token: token2 });
        if (!got.json?.lead) throw new Error('phantom lead');
      }
      return 'session ok';
    });
  }

  return rows;
}
