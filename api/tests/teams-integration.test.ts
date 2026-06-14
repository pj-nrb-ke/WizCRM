import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { buildApp } from '../src/app.js';
import { prisma } from '../src/lib/prisma.js';
import type { FastifyInstance } from 'fastify';

const run = process.env.RUN_INTEGRATION_TESTS === '1';

describe.runIf(run)('WEB-012 teams CRUD (P5)', () => {
  let app: FastifyInstance;
  let managerToken: string;
  let repToken: string;
  let createdTeamId: string;

  beforeAll(async () => {
    app = await buildApp();
    await app.ready();
    const mgr = await app.inject({
      method: 'POST',
      url: '/auth/login',
      payload: { email: 'manager@wizag.local', password: 'wizcrm123' },
    });
    expect(mgr.statusCode).toBe(200);
    managerToken = mgr.json().token;

    const rep = await app.inject({
      method: 'POST',
      url: '/auth/login',
      payload: { email: 'rep@wizag.local', password: 'wizcrm123' },
    });
    repToken = rep.json().token;
  });

  afterAll(async () => {
    if (createdTeamId) {
      await prisma.team.deleteMany({ where: { id: createdTeamId } }).catch(() => {});
    }
    await app.close();
    await prisma.$disconnect();
  });

  const mgrAuth = () => ({ authorization: `Bearer ${managerToken}` });
  const repAuth = () => ({ authorization: `Bearer ${repToken}` });

  it('manager can list teams via /teams and /admin/teams', async () => {
    const teams = await app.inject({ method: 'GET', url: '/teams', headers: mgrAuth() });
    expect(teams.statusCode).toBe(200);
    expect(Array.isArray(teams.json().teams)).toBe(true);

    const admin = await app.inject({ method: 'GET', url: '/admin/teams', headers: mgrAuth() });
    expect(admin.statusCode).toBe(200);
    expect(Array.isArray(admin.json().teams)).toBe(true);
  });

  it('rep cannot create team (403)', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/teams',
      headers: repAuth(),
      payload: { name: 'Rep Team' },
    });
    expect(res.statusCode).toBe(403);
  });

  it('manager creates, updates, assigns members, deletes team', async () => {
    const name = `QA Team ${Date.now()}`;
    const create = await app.inject({
      method: 'POST',
      url: '/teams',
      headers: mgrAuth(),
      payload: { name },
    });
    expect(create.statusCode).toBe(201);
    createdTeamId = create.json().team.id as string;

    const patch = await app.inject({
      method: 'PATCH',
      url: `/teams/${createdTeamId}`,
      headers: mgrAuth(),
      payload: { name: `${name} Updated` },
    });
    expect(patch.statusCode).toBe(200);
    expect(patch.json().team.name).toContain('Updated');

    const users = await app.inject({
      method: 'GET',
      url: '/teams/assignable-users',
      headers: mgrAuth(),
    });
    const repUser = (users.json().users as Array<{ id: string; email: string }>).find(
      (u) => u.email === 'rep@wizag.local',
    );
    expect(repUser).toBeTruthy();

    const members = await app.inject({
      method: 'PUT',
      url: `/teams/${createdTeamId}/members`,
      headers: mgrAuth(),
      payload: { userIds: [repUser!.id] },
    });
    expect(members.statusCode).toBe(200);
    expect(members.json().team.members.some((m: { email: string }) => m.email === 'rep@wizag.local')).toBe(
      true,
    );

    const del = await app.inject({
      method: 'DELETE',
      url: `/teams/${createdTeamId}`,
      headers: mgrAuth(),
    });
    expect(del.statusCode).toBe(200);
    createdTeamId = '';
  });
});
