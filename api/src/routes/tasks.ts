import type { FastifyPluginAsync } from 'fastify';
import { createTaskSchema, createTaskUpdateSchema, normalizeLeadTags, updateTaskSchema } from '@wizcrm/shared';
import { prisma } from '../lib/prisma.js';

export const taskRoutes: FastifyPluginAsync = async (app) => {
  app.addHook('onRequest', app.authenticate);

  app.get('/', async (request) => {
    const { organizationId, sub: userId } = request.user;
    const tasks = await prisma.task.findMany({
      where: { organizationId, userId, completedAt: null },
      orderBy: { dueAt: 'asc' },
      include: { lead: { select: { id: true, name: true } } },
    });
    return { tasks };
  });

  app.post('/', async (request, reply) => {
    const { organizationId, sub: userId } = request.user;
    const parsed = createTaskSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.status(400).send({ error: parsed.error.flatten() });
    }
    if (parsed.data.leadId) {
      const lead = await prisma.lead.findFirst({
        where: { id: parsed.data.leadId, organizationId },
      });
      if (!lead) return reply.status(404).send({ error: 'Lead not found' });
    }
    const task = await prisma.task.create({
      data: {
        organizationId,
        userId,
        leadId: parsed.data.leadId,
        title: parsed.data.title,
        dueAt: parsed.data.dueAt ? new Date(parsed.data.dueAt) : null,
        tags: normalizeLeadTags(parsed.data.tags),
      },
    });
    return reply.status(201).send({ task });
  });

  app.patch('/:id', async (request, reply) => {
    const { organizationId, sub: userId } = request.user;
    const { id } = request.params as { id: string };
    const parsed = updateTaskSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.status(400).send({ error: parsed.error.flatten() });
    }
    const existing = await prisma.task.findFirst({
      where: { id, organizationId, userId },
    });
    if (!existing) return reply.status(404).send({ error: 'Task not found' });

    const task = await prisma.task.update({
      where: { id },
      data: {
        title: parsed.data.title,
        dueAt:
          parsed.data.dueAt === null
            ? null
            : parsed.data.dueAt
              ? new Date(parsed.data.dueAt)
              : undefined,
        completedAt: parsed.data.completed ? new Date() : undefined,
        tags: parsed.data.tags !== undefined ? normalizeLeadTags(parsed.data.tags) : undefined,
      },
    });
    return { task };
  });

  // Task threads (VSM-SPEC §4.4) — owner or any manager/admin in the org can
  // read/reply; staff use this to tell the VSM (or a colleague) what happened.
  app.get('/:id/updates', async (request, reply) => {
    const { organizationId, sub: userId, role } = request.user;
    const { id } = request.params as { id: string };
    const task = await prisma.task.findFirst({ where: { id, organizationId } });
    if (!task) return reply.status(404).send({ error: 'Task not found' });
    if (task.userId !== userId && role === 'SALES') {
      return reply.status(403).send({ error: 'Not your task' });
    }
    const updates = await prisma.taskUpdate.findMany({
      where: { taskId: id },
      orderBy: { createdAt: 'asc' },
      include: { user: { select: { id: true, name: true } } },
    });
    return { updates };
  });

  app.post('/:id/updates', async (request, reply) => {
    const { organizationId, sub: userId, role } = request.user;
    const { id } = request.params as { id: string };
    const parsed = createTaskUpdateSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.status(400).send({ error: parsed.error.flatten() });
    }
    const task = await prisma.task.findFirst({ where: { id, organizationId } });
    if (!task) return reply.status(404).send({ error: 'Task not found' });
    if (task.userId !== userId && role === 'SALES') {
      return reply.status(403).send({ error: 'Not your task' });
    }
    const update = await prisma.taskUpdate.create({
      data: { taskId: id, userId, body: parsed.data.body },
      include: { user: { select: { id: true, name: true } } },
    });
    return reply.status(201).send({ update });
  });
};
