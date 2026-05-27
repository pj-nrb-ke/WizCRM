import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { buildApp } from '../src/app.js';
import { prisma } from '../src/lib/prisma.js';
import type { FastifyInstance } from 'fastify';

const runIntegration = process.env.RUN_INTEGRATION_TESTS === '1';

describe.runIf(runIntegration)('UT-INF-004 API integration', () => {
  let app: FastifyInstance;
  let token: string;

  beforeAll(async () => {
    app = await buildApp();
    await app.ready();
    const login = await app.inject({
      method: 'POST',
      url: '/auth/login',
      payload: { email: 'rep@wizag.local', password: 'wizcrm123' },
    });
    expect(login.statusCode).toBe(200);
    token = login.json().token;
  });

  afterAll(async () => {
    await app.close();
    await prisma.$disconnect();
  });

  it('health returns ok', async () => {
    const res = await app.inject({ method: 'GET', url: '/health' });
    expect(res.statusCode).toBe(200);
    expect(res.json().status).toBe('ok');
  });

  it('UT-LITE-013 rejects invalid login', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/auth/login',
      payload: { email: 'rep@wizag.local', password: 'wrong' },
    });
    expect(res.statusCode).toBe(401);
  });

  it('UT-LITE-001 creates lead with phone', async () => {
    const phone = `+2782${Date.now().toString().slice(-7)}`;
    const res = await app.inject({
      method: 'POST',
      url: '/leads',
      headers: { authorization: `Bearer ${token}` },
      payload: {
        name: 'Test Lead',
        phone,
        company: 'ACME',
      },
    });
    expect(res.statusCode).toBe(201);
    expect(res.json().lead.name).toBe('Test Lead');
  });

  it('UT-LITE-002 flags duplicate phone', async () => {
    const phone = `+2783${Date.now().toString().slice(-7)}`;
    await app.inject({
      method: 'POST',
      url: '/leads',
      headers: { authorization: `Bearer ${token}` },
      payload: { name: 'First', phone },
    });
    const res = await app.inject({
      method: 'POST',
      url: '/leads',
      headers: { authorization: `Bearer ${token}` },
      payload: {
        name: 'Duplicate',
        phone,
      },
    });
    expect(res.statusCode).toBe(409);
    expect(res.json().error).toBe('DUPLICATE');
  });

  it('concurrent duplicate phone creates at most one row', async () => {
    const phone = `+2784${Date.now().toString().slice(-7)}`;
    const headers = { authorization: `Bearer ${token}` };
    const results = await Promise.all(
      Array.from({ length: 5 }, (_, i) =>
        app.inject({
          method: 'POST',
          url: '/leads',
          headers,
          payload: { name: `Race ${i}`, phone },
        }),
      ),
    );
    const created = results.filter((r) => r.statusCode === 201).length;
    const dup = results.filter((r) => r.statusCode === 409).length;
    expect(created).toBe(1);
    expect(dup).toBe(4);
  });

  it('E2E-LITE-TIMELINE note saved and listed newest first', async () => {
    const create = await app.inject({
      method: 'POST',
      url: '/leads',
      headers: { authorization: `Bearer ${token}` },
      payload: { name: 'Timeline Lead', email: `timeline-${Date.now()}@test.local` },
    });
    expect(create.statusCode).toBe(201);
    const leadId = create.json().lead.id as string;

    const note = await app.inject({
      method: 'POST',
      url: `/leads/${leadId}/activities`,
      headers: { authorization: `Bearer ${token}` },
      payload: { type: 'NOTE', body: 'Cluster 2 timeline note' },
    });
    expect(note.statusCode).toBe(201);

    const list = await app.inject({
      method: 'GET',
      url: `/leads/${leadId}/activities`,
      headers: { authorization: `Bearer ${token}` },
    });
    expect(list.statusCode).toBe(200);
    const activities = list.json().activities as Array<{ body: string; createdAt: string }>;
    expect(activities[0].body).toContain('Cluster 2 timeline note');
    for (let i = 1; i < activities.length; i++) {
      expect(new Date(activities[i - 1].createdAt).getTime()).toBeGreaterThanOrEqual(
        new Date(activities[i].createdAt).getTime(),
      );
    }
  });

  it('E2E-LITE-POSTCALL confirm without applyStage keeps stage', async () => {
    const create = await app.inject({
      method: 'POST',
      url: '/leads',
      headers: { authorization: `Bearer ${token}` },
      payload: { name: 'PostCall Lead', phone: `+2788${Date.now().toString().slice(-7)}` },
    });
    expect(create.statusCode).toBe(201);
    const leadId = create.json().lead.id as string;
    const initialStage = create.json().lead.stage as string;

    const confirm = await app.inject({
      method: 'POST',
      url: '/ai/post-call/confirm',
      headers: { authorization: `Bearer ${token}` },
      payload: {
        leadId,
        summary: 'Discussed pricing',
        suggestedStage: 'CONTACTED',
        applyStage: false,
      },
    });
    expect(confirm.statusCode).toBe(200);

    const get = await app.inject({
      method: 'GET',
      url: `/leads/${leadId}`,
      headers: { authorization: `Bearer ${token}` },
    });
    expect(get.json().lead.stage).toBe(initialStage);
  });

  it('UT-LITE-007 next-action dismiss endpoint persists', async () => {
    const create = await app.inject({
      method: 'POST',
      url: '/leads',
      headers: { authorization: `Bearer ${token}` },
      payload: { name: 'Dismiss Lead', email: `dismiss-${Date.now()}@test.local` },
    });
    const leadId = create.json().lead.id as string;

    const dismiss = await app.inject({
      method: 'POST',
      url: `/ai/leads/${leadId}/next-action/dismiss`,
      headers: { authorization: `Bearer ${token}` },
      payload: { action: 'Send proposal' },
    });
    expect(dismiss.statusCode).toBe(200);
    expect(dismiss.json().ok).toBe(true);
  });
});

describe('UT-INF-004 auth validation (no DB)', () => {
  it('login schema rejects empty password', async () => {
    const { loginSchema } = await import('@wizcrm/shared');
    expect(loginSchema.safeParse({ email: 'a@b.com', password: '' }).success).toBe(false);
  });
});
