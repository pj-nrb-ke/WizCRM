import type { FastifyPluginAsync } from 'fastify';
import {
  assignTeamMembersSchema,
  createTeamSchema,
  teamActivityFeedQuerySchema,
  updateTeamSchema,
} from '@wizcrm/shared';
import { loadTeamActivityFeed } from '../services/activity-feed.service.js';
import { loadMetricDetails, type MetricKind } from '../services/team-metrics.service.js';
import { prisma } from '../lib/prisma.js';
import {
  getTeamMemberIds,
  loadOrganizationTeamContext,
} from '../services/team.service.js';

function isManagerRole(role: string) {
  return role === 'MANAGER' || role === 'ADMIN';
}

export const teamRoutes: FastifyPluginAsync = async (app) => {
  app.addHook('onRequest', app.authenticate);

  app.get('/activity-feed', async (request, reply) => {
    const { organizationId, role } = request.user;
    if (!isManagerRole(role)) {
      return reply.status(403).send({ error: 'Managers only' });
    }
    const parsed = teamActivityFeedQuerySchema.safeParse(request.query);
    if (!parsed.success) {
      return reply.status(400).send({ error: parsed.error.flatten() });
    }
    const items = await loadTeamActivityFeed(organizationId, parsed.data);
    return { items };
  });

  app.get('/metrics/:metric', async (request, reply) => {
    const { organizationId, role } = request.user;
    if (!isManagerRole(role)) {
      return reply.status(403).send({ error: 'Managers only' });
    }
    const { metric } = request.params as { metric: string };
    if (!['open', 'stale', 'won', 'overdue'].includes(metric)) {
      return reply.status(400).send({ error: 'Invalid metric' });
    }
    const q = request.query as { teamId?: string; ownerId?: string };
    const details = await loadMetricDetails(
      organizationId,
      metric as MetricKind,
      { teamId: q.teamId, ownerId: q.ownerId },
    );
    return details;
  });

  app.get('/', async (request, reply) => {
    const { organizationId, role } = request.user;
    if (!isManagerRole(role)) {
      return reply.status(403).send({ error: 'Managers only' });
    }
    const data = await loadOrganizationTeamContext(organizationId);
    return data;
  });

  app.get('/assignable-users', async (request, reply) => {
    const { organizationId, role } = request.user;
    if (!isManagerRole(role)) {
      return reply.status(403).send({ error: 'Managers only' });
    }
    const users = await prisma.user.findMany({
      where: { organizationId, role: 'SALES' },
      select: { id: true, name: true, email: true, teamId: true },
      orderBy: { name: 'asc' },
    });
    return { users };
  });

  app.get('/:id', async (request, reply) => {
    const { organizationId, role } = request.user;
    if (!isManagerRole(role)) {
      return reply.status(403).send({ error: 'Managers only' });
    }
    const { id } = request.params as { id: string };
    const data = await loadOrganizationTeamContext(organizationId);
    const team = data.teams.find((t) => t.id === id);
    if (!team) {
      return reply.status(404).send({ error: 'Team not found' });
    }
    return { team };
  });

  app.post('/', async (request, reply) => {
    const { organizationId, role } = request.user;
    if (!isManagerRole(role)) {
      return reply.status(403).send({ error: 'Managers only' });
    }
    const parsed = createTeamSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.status(400).send({ error: parsed.error.flatten() });
    }
    try {
      const team = await prisma.team.create({
        data: {
          organizationId,
          name: parsed.data.name.trim(),
        },
      });
      return reply.status(201).send({ team: { id: team.id, name: team.name } });
    } catch {
      return reply.status(409).send({ error: 'A team with this name already exists' });
    }
  });

  app.patch('/:id', async (request, reply) => {
    const { organizationId, role } = request.user;
    if (!isManagerRole(role)) {
      return reply.status(403).send({ error: 'Managers only' });
    }
    const { id } = request.params as { id: string };
    const parsed = updateTeamSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.status(400).send({ error: parsed.error.flatten() });
    }
    const existing = await prisma.team.findFirst({
      where: { id, organizationId },
    });
    if (!existing) {
      return reply.status(404).send({ error: 'Team not found' });
    }
    try {
      const team = await prisma.team.update({
        where: { id },
        data: { name: parsed.data.name.trim() },
      });
      return { team: { id: team.id, name: team.name } };
    } catch {
      return reply.status(409).send({ error: 'A team with this name already exists' });
    }
  });

  app.put('/:id/members', async (request, reply) => {
    const { organizationId, role } = request.user;
    if (!isManagerRole(role)) {
      return reply.status(403).send({ error: 'Managers only' });
    }
    const { id } = request.params as { id: string };
    const parsed = assignTeamMembersSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.status(400).send({ error: parsed.error.flatten() });
    }

    const team = await prisma.team.findFirst({
      where: { id, organizationId },
    });
    if (!team) {
      return reply.status(404).send({ error: 'Team not found' });
    }

    const salesUsers = await prisma.user.findMany({
      where: {
        organizationId,
        role: 'SALES',
        id: { in: parsed.data.userIds },
      },
      select: { id: true },
    });
    if (salesUsers.length !== parsed.data.userIds.length) {
      return reply.status(400).send({ error: 'All members must be sales users in your organization' });
    }

    await prisma.$transaction([
      prisma.user.updateMany({
        where: { organizationId, teamId: id, role: 'SALES' },
        data: { teamId: null },
      }),
      prisma.user.updateMany({
        where: { id: { in: parsed.data.userIds }, organizationId, role: 'SALES' },
        data: { teamId: id },
      }),
    ]);

    const data = await loadOrganizationTeamContext(organizationId);
    const updated = data.teams.find((t) => t.id === id);
    return { team: updated };
  });

  app.delete('/:id', async (request, reply) => {
    const { organizationId, role } = request.user;
    if (!isManagerRole(role)) {
      return reply.status(403).send({ error: 'Managers only' });
    }
    const { id } = request.params as { id: string };
    const team = await prisma.team.findFirst({
      where: { id, organizationId },
    });
    if (!team) {
      return reply.status(404).send({ error: 'Team not found' });
    }
    await prisma.$transaction([
      prisma.user.updateMany({
        where: { teamId: id },
        data: { teamId: null },
      }),
      prisma.team.delete({ where: { id } }),
    ]);
    return { ok: true };
  });
};
