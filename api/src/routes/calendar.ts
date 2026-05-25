import type { FastifyPluginAsync } from 'fastify';
import {
  calendarQuerySchema,
  createCalendarEventSchema,
  updateCalendarEventSchema,
} from '@wizcrm/shared';
import {
  createCalendarEvent,
  deleteCalendarEvent,
  listCalendarEvents,
  updateCalendarEvent,
} from '../services/calendar.service.js';

export const calendarRoutes: FastifyPluginAsync = async (app) => {
  app.addHook('onRequest', app.authenticate);

  app.get('/events', async (request) => {
    const { organizationId, sub: userId, role } = request.user;
    const q = calendarQuerySchema.safeParse(request.query);
    const query = q.success ? q.data : {};
    const events = await listCalendarEvents(organizationId, userId, role, {
      from: query.from,
      to: query.to,
      teamScope: role === 'MANAGER' || role === 'ADMIN',
    });
    return { events };
  });

  app.post('/events', async (request, reply) => {
    const { organizationId, sub: userId } = request.user;
    const parsed = createCalendarEventSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.status(400).send({ error: parsed.error.flatten() });
    }
    const event = await createCalendarEvent(organizationId, userId, parsed.data);
    if (!event) return reply.status(404).send({ error: 'Lead not found' });
    return reply.status(201).send({ event });
  });

  app.patch('/events/:id', async (request, reply) => {
    const { organizationId, sub: userId, role } = request.user;
    const { id } = request.params as { id: string };
    const parsed = updateCalendarEventSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.status(400).send({ error: parsed.error.flatten() });
    }
    const event = await updateCalendarEvent(id, organizationId, userId, role, parsed.data);
    if (!event) return reply.status(404).send({ error: 'Event not found' });
    return { event };
  });

  app.delete('/events/:id', async (request, reply) => {
    const { organizationId, sub: userId, role } = request.user;
    const { id } = request.params as { id: string };
    const ok = await deleteCalendarEvent(id, organizationId, userId, role);
    if (!ok) return reply.status(404).send({ error: 'Event not found' });
    return { ok: true };
  });
};
