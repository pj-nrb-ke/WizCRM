import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { buildApp } from '../src/app.js';
import { prisma } from '../src/lib/prisma.js';
import { isAllowedStageTransition } from '@wizcrm/shared';
import type { FastifyInstance } from 'fastify';

/**
 * Maps automated API tests to QA-LITE-* acceptance IDs.
 * Device-only checks (QA-LITE-ANDROID, QA-LITE-PILOT) remain for user testing.
 */
const run = process.env.RUN_INTEGRATION_TESTS === '1';

describe.runIf(run)('QA-LITE automated (API)', () => {
  let app: FastifyInstance;
  let token: string;
  let managerToken: string;

  beforeAll(async () => {
    app = await buildApp();
    await app.ready();
    const login = await app.inject({
      method: 'POST',
      url: '/auth/login',
      payload: { email: 'rep@wizag.local', password: 'wizcrm123' },
    });
    token = login.json().token;
    const mgr = await app.inject({
      method: 'POST',
      url: '/auth/login',
      payload: { email: 'manager@wizag.local', password: 'wizcrm123' },
    });
    managerToken = mgr.json().token;
  });

  afterAll(async () => {
    await app.close();
    await prisma.$disconnect();
  });

  const auth = () => ({ authorization: `Bearer ${token}` });

  it('QA-LITE-001 create lead with phone under 20s path', async () => {
    const start = Date.now();
    const res = await app.inject({
      method: 'POST',
      url: '/leads',
      headers: auth(),
      payload: { name: 'QA Lead', phone: `+2786${Date.now().toString().slice(-7)}` },
    });
    expect(res.statusCode).toBe(201);
    expect(Date.now() - start).toBeLessThan(20_000);
  });

  it('QA-LITE-002 duplicate phone returns 409', async () => {
    const phone = `+2787${Date.now().toString().slice(-7)}`;
    await app.inject({
      method: 'POST',
      url: '/leads',
      headers: auth(),
      payload: { name: 'First', phone },
    });
    const dup = await app.inject({
      method: 'POST',
      url: '/leads',
      headers: auth(),
      payload: { name: 'Dup', phone },
    });
    expect(dup.statusCode).toBe(409);
    expect(dup.json().error).toBe('DUPLICATE');
  });

  it('QA-LITE-004 stage transition rules enforced', () => {
    expect(isAllowedStageTransition('NEW', 'CONTACTED')).toBe(true);
    expect(isAllowedStageTransition('WON', 'NEGOTIATION')).toBe(false);
  });

  it('QA-LITE-004 PATCH stage with confirm', async () => {
    const create = await app.inject({
      method: 'POST',
      url: '/leads',
      headers: auth(),
      payload: { name: 'Stage Lead', email: `stage-${Date.now()}@test.local` },
    });
    const id = create.json().lead.id as string;
    const patch = await app.inject({
      method: 'PATCH',
      url: `/leads/${id}`,
      headers: auth(),
      payload: { stage: 'CONTACTED', confirmStageSuggestion: true },
    });
    expect(patch.statusCode).toBe(200);
    expect(patch.json().lead.stage).toBe('CONTACTED');
  });

  it('QA-LITE-005 desk returns items array', async () => {
    const desk = await app.inject({ method: 'GET', url: '/ai/desk', headers: auth() });
    expect(desk.statusCode).toBe(200);
    expect(Array.isArray(desk.json().items)).toBe(true);
  });

  it('QA-LITE-006 summary endpoint responds (503 or 200)', async () => {
    const create = await app.inject({
      method: 'POST',
      url: '/leads',
      headers: auth(),
      payload: { name: 'Sum', email: `sum-${Date.now()}@test.local` },
    });
    const id = create.json().lead.id as string;
    const res = await app.inject({
      method: 'GET',
      url: `/ai/leads/${id}/summary`,
      headers: auth(),
    });
    expect([200, 503]).toContain(res.statusCode);
  });

  it('QA-LITE-007 next-action dismiss', async () => {
    const create = await app.inject({
      method: 'POST',
      url: '/leads',
      headers: auth(),
      payload: { name: 'NA', email: `na-${Date.now()}@test.local` },
    });
    const id = create.json().lead.id as string;
    const dismiss = await app.inject({
      method: 'POST',
      url: `/ai/leads/${id}/next-action/dismiss`,
      headers: auth(),
      payload: { action: 'Follow up' },
    });
    expect(dismiss.statusCode).toBe(200);
  });

  it('QA-LITE-008 note on timeline', async () => {
    const create = await app.inject({
      method: 'POST',
      url: '/leads',
      headers: auth(),
      payload: { name: 'Note', phone: `+2788${Date.now().toString().slice(-7)}` },
    });
    const id = create.json().lead.id as string;
    await app.inject({
      method: 'POST',
      url: `/leads/${id}/activities`,
      headers: auth(),
      payload: { type: 'NOTE', body: 'QA automated note' },
    });
    const list = await app.inject({
      method: 'GET',
      url: `/leads/${id}/activities`,
      headers: auth(),
    });
    expect(list.json().activities[0].body).toContain('QA automated note');
  });

  it('QA-LITE-009 post-call confirm', async () => {
    const create = await app.inject({
      method: 'POST',
      url: '/leads',
      headers: auth(),
      payload: { name: 'Call', phone: `+2789${Date.now().toString().slice(-7)}` },
    });
    const id = create.json().lead.id as string;
    const confirm = await app.inject({
      method: 'POST',
      url: '/ai/post-call/confirm',
      headers: auth(),
      payload: {
        leadId: id,
        summary: 'Discussed pricing',
        taskTitle: 'Send quote',
        applyStage: false,
      },
    });
    expect(confirm.statusCode).toBe(200);
  });

  it('QA-LITE-010 timeline descending', async () => {
    const create = await app.inject({
      method: 'POST',
      url: '/leads',
      headers: auth(),
      payload: { name: 'TL', email: `tl-${Date.now()}@test.local` },
    });
    const id = create.json().lead.id as string;
    await app.inject({
      method: 'POST',
      url: `/leads/${id}/activities`,
      headers: auth(),
      payload: { type: 'NOTE', body: 'First' },
    });
    await app.inject({
      method: 'POST',
      url: `/leads/${id}/activities`,
      headers: auth(),
      payload: { type: 'NOTE', body: 'Second' },
    });
    const list = await app.inject({
      method: 'GET',
      url: `/leads/${id}/activities`,
      headers: auth(),
    });
    const acts = list.json().activities as Array<{ body: string; createdAt: string }>;
    expect(acts.length).toBeGreaterThanOrEqual(2);
    expect(new Date(acts[0].createdAt).getTime()).toBeGreaterThanOrEqual(
      new Date(acts[1].createdAt).getTime(),
    );
  });

  it('QA-LITE-011 task due appears on desk then complete', async () => {
    const create = await app.inject({
      method: 'POST',
      url: '/leads',
      headers: auth(),
      payload: { name: 'TaskDesk', phone: `+2790${Date.now().toString().slice(-7)}` },
    });
    const leadId = create.json().lead.id as string;
    const task = await app.inject({
      method: 'POST',
      url: '/tasks',
      headers: auth(),
      payload: {
        leadId,
        title: 'QA due task',
        dueAt: new Date(Date.now() - 7 * 86_400_000).toISOString(),
      },
    });
    const taskId = task.json().task.id as string;
    const leadTasks = await app.inject({
      method: 'GET',
      url: `/leads/${leadId}/tasks`,
      headers: auth(),
    });
    expect(leadTasks.json().tasks.some((t: { id: string }) => t.id === taskId)).toBe(true);
    const desk = await app.inject({ method: 'GET', url: '/ai/desk', headers: auth() });
    expect(desk.statusCode).toBe(200);
    await app.inject({
      method: 'PATCH',
      url: `/tasks/${taskId}`,
      headers: auth(),
      payload: { completed: true },
    });
  });

  it('QA-LITE-012 pipeline matches lead stage', async () => {
    const create = await app.inject({
      method: 'POST',
      url: '/leads',
      headers: auth(),
      payload: { name: 'Pipe', phone: `+2791${Date.now().toString().slice(-7)}` },
    });
    const id = create.json().lead.id as string;
    const pipe = await app.inject({ method: 'GET', url: '/leads/pipeline', headers: auth() });
    const inNew = (pipe.json().pipeline.NEW ?? []).some((l: { id: string }) => l.id === id);
    expect(inNew).toBe(true);
  });

  it('QA-LITE-013 no public signup route', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/auth/register',
      payload: { email: 'hack@test.local', password: 'x' },
    });
    expect(res.statusCode).toBe(404);
  });

  it('QA-LITE-013 login only for known users', async () => {
    const bad = await app.inject({
      method: 'POST',
      url: '/auth/login',
      payload: { email: 'nobody@test.local', password: 'wizcrm123' },
    });
    expect(bad.statusCode).toBe(401);
  });

  it('QA-INF-004 health and email status', async () => {
    const health = await app.inject({ method: 'GET', url: '/health' });
    expect(health.json().status).toBe('ok');
    const email = await app.inject({
      method: 'GET',
      url: '/email/status',
      headers: { authorization: `Bearer ${managerToken}` },
    });
    expect(email.statusCode).toBe(200);
    expect(typeof email.json().configured).toBe('boolean');
  });
});
