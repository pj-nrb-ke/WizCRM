import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { buildApp } from '../src/app.js';
import { prisma } from '../src/lib/prisma.js';
import type { FastifyInstance } from 'fastify';

const run = process.env.RUN_INTEGRATION_TESTS === '1';

describe.runIf(run)('Lite mobile API journeys (P1/P2)', () => {
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

  const auth = () => ({ authorization: `Bearer ${token}` });

  it('E2E-LITE-LOGIN returns token and user', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/auth/login',
      payload: { email: 'rep@wizag.local', password: 'wizcrm123' },
    });
    expect(res.statusCode).toBe(200);
    expect(res.json().token).toBeTruthy();
    expect(res.json().user.email).toBe('rep@wizag.local');
  });

  it('UT-LITE-001 rejects lead without phone or email', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/leads',
      headers: auth(),
      payload: { name: 'No Contact' },
    });
    expect(res.statusCode).toBe(400);
  });

  it('UT-LITE-001 creates lead with source and priority', async () => {
    const phone = `+2783${Date.now().toString().slice(-7)}`;
    const res = await app.inject({
      method: 'POST',
      url: '/leads',
      headers: auth(),
      payload: {
        name: 'Priority Lead',
        phone,
        source: 'Event',
        priority: 'HOT',
      },
    });
    expect(res.statusCode).toBe(201);
    expect(res.json().lead.priority).toBe('HOT');
    expect(res.json().lead.source).toBe('Event');
  });

  it('E2E-LITE-LEAD lists new lead and pipeline bucket', async () => {
    const phone = `+2784${Date.now().toString().slice(-7)}`;
    const create = await app.inject({
      method: 'POST',
      url: '/leads',
      headers: auth(),
      payload: { name: 'Pipeline Lead', phone },
    });
    expect(create.statusCode).toBe(201);
    const leadId = create.json().lead.id as string;

    const list = await app.inject({ method: 'GET', url: '/leads', headers: auth() });
    expect(list.statusCode).toBe(200);
    const leads = list.json().leads as Array<{ id: string }>;
    expect(leads.some((l) => l.id === leadId)).toBe(true);

    const pipe = await app.inject({ method: 'GET', url: '/leads/pipeline', headers: auth() });
    expect(pipe.statusCode).toBe(200);
    const pipeline = pipe.json().pipeline as Record<string, Array<{ id: string }>>;
    const inNew = (pipeline.NEW ?? []).some((l) => l.id === leadId);
    expect(inNew).toBe(true);
  });

  it('UT-LITE-011 task create and complete', async () => {
    const create = await app.inject({
      method: 'POST',
      url: '/leads',
      headers: auth(),
      payload: { name: 'Task Lead', email: `task-${Date.now()}@test.local` },
    });
    const leadId = create.json().lead.id as string;

    const task = await app.inject({
      method: 'POST',
      url: '/tasks',
      headers: auth(),
      payload: {
        leadId,
        title: 'Call back',
        dueAt: new Date(Date.now() - 3600_000).toISOString(),
      },
    });
    expect(task.statusCode).toBe(201);

    const complete = await app.inject({
      method: 'PATCH',
      url: `/tasks/${task.json().task.id}`,
      headers: auth(),
      payload: { completed: true },
    });
    expect(complete.statusCode).toBe(200);
    expect(complete.json().task.completedAt).toBeTruthy();
  });

  it('E2E-LITE-DESK includes due task for rep', async () => {
    const create = await app.inject({
      method: 'POST',
      url: '/leads',
      headers: auth(),
      payload: { name: 'Desk Lead', phone: `+2785${Date.now().toString().slice(-7)}` },
    });
    const leadId = create.json().lead.id as string;

    const task = await app.inject({
      method: 'POST',
      url: '/tasks',
      headers: auth(),
      payload: {
        leadId,
        title: 'Overdue follow-up',
        dueAt: new Date(Date.now() - 7 * 86_400_000).toISOString(),
      },
    });
    expect(task.statusCode).toBe(201);
    const taskId = task.json().task.id as string;

    const leadTasks = await app.inject({
      method: 'GET',
      url: `/leads/${leadId}/tasks`,
      headers: auth(),
    });
    expect(leadTasks.json().tasks.some((t: { id: string }) => t.id === taskId)).toBe(true);

    const desk = await app.inject({ method: 'GET', url: '/ai/desk', headers: auth() });
    expect(desk.statusCode).toBe(200);
    expect((desk.json().items as unknown[]).length).toBeLessThanOrEqual(8);
  });

  it('UT-LITE-010 insights and draft-message endpoints', async () => {
    const create = await app.inject({
      method: 'POST',
      url: '/leads',
      headers: auth(),
      payload: {
        name: 'Insights Lead',
        email: `insights-${Date.now()}@test.local`,
        priority: 'WARM',
      },
    });
    const leadId = create.json().lead.id as string;

    const insights = await app.inject({
      method: 'GET',
      url: `/leads/${leadId}/insights`,
      headers: auth(),
    });
    expect(insights.statusCode).toBe(200);
    expect(insights.json().insights.scores.urgency).toBeGreaterThan(0);

    const draft = await app.inject({
      method: 'GET',
      url: `/ai/leads/${leadId}/draft-message?channel=whatsapp`,
      headers: auth(),
    });
    expect(draft.statusCode).toBe(200);
    expect(draft.json().draft).toContain('Hi');
  });

  it('UT-LITE-013 rejects protected route without token', async () => {
    const res = await app.inject({ method: 'GET', url: '/leads' });
    expect(res.statusCode).toBe(401);
  });
});
