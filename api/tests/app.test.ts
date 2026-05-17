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
    const res = await app.inject({
      method: 'POST',
      url: '/leads',
      headers: { authorization: `Bearer ${token}` },
      payload: {
        name: 'Test Lead',
        phone: '+27821234567',
        company: 'ACME',
      },
    });
    expect(res.statusCode).toBe(201);
    expect(res.json().lead.name).toBe('Test Lead');
  });

  it('UT-LITE-002 flags duplicate phone', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/leads',
      headers: { authorization: `Bearer ${token}` },
      payload: {
        name: 'Duplicate',
        phone: '+27821234567',
      },
    });
    expect(res.statusCode).toBe(409);
    expect(res.json().error).toBe('DUPLICATE');
  });
});

describe('UT-INF-004 auth validation (no DB)', () => {
  it('login schema rejects empty password', async () => {
    const { loginSchema } = await import('@wizcrm/shared');
    expect(loginSchema.safeParse({ email: 'a@b.com', password: '' }).success).toBe(false);
  });
});
