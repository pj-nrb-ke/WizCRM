import type { FastifyPluginAsync } from 'fastify';
import { prisma } from '../lib/prisma.js';

// In-app notification feed (VSM-SPEC §4.5) — "VSM assigned you 4 tasks",
// "VSM replied on 'Chase Mombasa Ltd quote'". Rows are written by whatever
// service triggers them (vsm-execution, task-reply follow-ups); this route
// is just the read/ack surface.
export const notificationRoutes: FastifyPluginAsync = async (app) => {
  app.addHook('onRequest', app.authenticate);

  app.get('/', async (request) => {
    const { organizationId, sub: userId } = request.user;
    const [notifications, unreadCount] = await Promise.all([
      prisma.notification.findMany({
        where: { organizationId, userId },
        orderBy: { createdAt: 'desc' },
        take: 50,
      }),
      prisma.notification.count({ where: { organizationId, userId, readAt: null } }),
    ]);
    return { notifications, unreadCount };
  });

  app.post('/:id/read', async (request, reply) => {
    const { organizationId, sub: userId } = request.user;
    const { id } = request.params as { id: string };
    const existing = await prisma.notification.findFirst({ where: { id, organizationId, userId } });
    if (!existing) return reply.status(404).send({ error: 'Notification not found' });
    const notification = await prisma.notification.update({ where: { id }, data: { readAt: new Date() } });
    return { notification };
  });

  app.post('/read-all', async (request) => {
    const { organizationId, sub: userId } = request.user;
    await prisma.notification.updateMany({
      where: { organizationId, userId, readAt: null },
      data: { readAt: new Date() },
    });
    return { ok: true };
  });
};
