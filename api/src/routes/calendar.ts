import type { FastifyPluginAsync } from 'fastify';
import {
  calendarCheckInSchema,
  calendarCheckOutSchema,
  calendarQuerySchema,
  createCalendarEventSchema,
  updateCalendarEventSchema,
} from '@wizcrm/shared';
import {
  checkInCalendarEvent,
  checkOutCalendarEvent,
  createCalendarEvent,
  deleteCalendarEvent,
  listCalendarEvents,
  updateCalendarEvent,
} from '../services/calendar.service.js';
import { loadAttendanceReport } from '../services/attendance-report.service.js';

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

  app.post('/events/:id/check-in', async (request, reply) => {
    const { organizationId, sub: userId, role } = request.user;
    const { id } = request.params as { id: string };
    const parsed = calendarCheckInSchema.safeParse(request.body ?? {});
    if (!parsed.success) {
      return reply.status(400).send({ error: parsed.error.flatten() });
    }
    try {
      const event = await checkInCalendarEvent(id, organizationId, userId, role, parsed.data);
      if (!event) return reply.status(404).send({ error: 'Event not found' });
      return { event };
    } catch (e) {
      if (e && typeof e === 'object' && 'code' in e && (e as any).code === 'GEOFENCE') {
        return reply.status(409).send({
          error: 'Outside meeting geofence',
          code: 'GEOFENCE',
          distanceM: (e as any).distanceM,
          radiusM: (e as any).radiusM,
        });
      }
      throw e;
    }
  });

  app.post('/events/:id/check-out', async (request, reply) => {
    const { organizationId, sub: userId, role } = request.user;
    const { id } = request.params as { id: string };
    const parsed = calendarCheckOutSchema.safeParse(request.body ?? {});
    if (!parsed.success) {
      return reply.status(400).send({ error: parsed.error.flatten() });
    }
    const event = await checkOutCalendarEvent(id, organizationId, userId, role, parsed.data);
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

  app.get('/attendance/report', async (request, reply) => {
    const { organizationId, role } = request.user;
    if (role !== 'MANAGER' && role !== 'ADMIN') {
      return reply.status(403).send({ error: 'Managers only' });
    }
    const q = request.query as { teamId?: string; dateFrom?: string; dateTo?: string };
    const now = new Date();
    const defaultFrom = new Date(now);
    defaultFrom.setDate(defaultFrom.getDate() - 30);
    const dateFrom = q.dateFrom ? new Date(q.dateFrom) : defaultFrom;
    const dateTo = q.dateTo ? new Date(q.dateTo) : now;
    if (Number.isNaN(dateFrom.getTime()) || Number.isNaN(dateTo.getTime())) {
      return reply.status(400).send({ error: 'Invalid dateFrom/dateTo. Expected ISO date string.' });
    }
    const report = await loadAttendanceReport(organizationId, { dateFrom, dateTo }, q.teamId);
    if (!report) return reply.status(404).send({ error: 'Team not found' });
    return { report };
  });
};
