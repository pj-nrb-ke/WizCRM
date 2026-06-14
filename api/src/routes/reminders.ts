import type { FastifyPluginAsync } from 'fastify';
import { createUserReminderSchema, updateUserReminderSchema } from '@wizcrm/shared';
import {
  createUserReminder,
  deleteUserReminder,
  listUserReminders,
  updateUserReminder,
} from '../services/user-reminder.service.js';

export const reminderRoutes: FastifyPluginAsync = async (app) => {
  app.addHook('onRequest', app.authenticate);

  app.get('/', async (request) => {
    const { organizationId, sub: userId } = request.user;
    const q = request.query as { from?: string; to?: string };
    const reminders = await listUserReminders(organizationId, userId, q.from, q.to);
    return { reminders };
  });

  app.post('/', async (request, reply) => {
    const { organizationId, sub: userId } = request.user;
    const parsed = createUserReminderSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.status(400).send({ error: parsed.error.flatten() });
    }
    const reminder = await createUserReminder(organizationId, userId, parsed.data);
    if (!reminder) return reply.status(404).send({ error: 'Lead or event not found' });
    return reply.status(201).send({ reminder });
  });

  app.patch('/:id', async (request, reply) => {
    const { organizationId, sub: userId } = request.user;
    const { id } = request.params as { id: string };
    const parsed = updateUserReminderSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.status(400).send({ error: parsed.error.flatten() });
    }
    const reminder = await updateUserReminder(id, organizationId, userId, parsed.data);
    if (!reminder) return reply.status(404).send({ error: 'Not found' });
    return { reminder };
  });

  app.delete('/:id', async (request, reply) => {
    const { organizationId, sub: userId } = request.user;
    const { id } = request.params as { id: string };
    const ok = await deleteUserReminder(id, organizationId, userId);
    if (!ok) return reply.status(404).send({ error: 'Not found' });
    return { ok: true };
  });
};
