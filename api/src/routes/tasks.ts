import type { FastifyPluginAsync } from 'fastify';
import { createTaskSchema, createTaskUpdateSchema, normalizeLeadTags, updateTaskSchema } from '@wizcrm/shared';
import { prisma } from '../lib/prisma.js';
import { flagTaskForHelp } from '../services/vsm-escalation.service.js';
import { maybeAskFollowUp } from '../services/vsm-followup.service.js';

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

  // Single-task detail — owner or any manager/admin in the org (same access
  // rule as the thread below, since the drawer shows both together).
  app.get('/:id', async (request, reply) => {
    const { organizationId, sub: userId, role } = request.user;
    const { id } = request.params as { id: string };
    const task = await prisma.task.findFirst({
      where: { id, organizationId },
      include: { lead: { select: { id: true, name: true, company: true } }, user: { select: { id: true, name: true } } },
    });
    if (!task) return reply.status(404).send({ error: 'Task not found' });
    if (task.userId !== userId && role === 'SALES') {
      return reply.status(403).send({ error: 'Not your task' });
    }
    return { task };
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

    // Best-effort: the VSM may ask one grounded follow-up question on its
    // own tasks (VSM-SPEC §4.6). Never let this fail the staff member's reply.
    try {
      await maybeAskFollowUp(organizationId, id, parsed.data.body);
    } catch {
      // swallow — the reply itself already succeeded
    }

    return reply.status(201).send({ update });
  });

  // "Need management help" (VSM-SPEC §4.7) — the one escalation trigger a
  // person raises themselves rather than a rule computing it.
  app.post('/:id/flag', async (request, reply) => {
    const { organizationId, sub: userId, role } = request.user;
    const { id } = request.params as { id: string };
    const body = (request.body ?? {}) as { note?: string };
    const task = await prisma.task.findFirst({ where: { id, organizationId } });
    if (!task) return reply.status(404).send({ error: 'Task not found' });
    if (task.userId !== userId && role === 'SALES') {
      return reply.status(403).send({ error: 'Not your task' });
    }
    const user = await prisma.user.findUnique({ where: { id: userId }, select: { name: true } });
    const escalation = await flagTaskForHelp(
      organizationId,
      id,
      userId,
      user?.name ?? 'Unknown',
      task.title,
      typeof body.note === 'string' ? body.note.slice(0, 1000) : null,
    );
    return reply.status(201).send({ escalation });
  });
};
