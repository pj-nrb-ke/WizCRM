import type { FastifyPluginAsync, FastifyReply, FastifyRequest } from 'fastify';
import {
  expoAddToCalendarSchema,
  expoDiscoverSchema,
  expoListQuerySchema,
} from '@wizcrm/shared';
import {
  addExpoToCalendar,
  discoverExpos,
  dismissExpo,
  ExpoFinderUnavailableError,
  ExpoNotDatedError,
  listExpos,
} from '../services/expo-finder.service.js';

/** Discovery spends web-search and LLM credits, so it is not open to everyone. */
function requireManager() {
  return async (request: FastifyRequest, reply: FastifyReply) => {
    if (request.user.role !== 'MANAGER' && request.user.role !== 'ADMIN') {
      return reply.status(403).send({ error: 'Managers and admins only' });
    }
  };
}

export const expoRoutes: FastifyPluginAsync = async (app) => {
  app.addHook('onRequest', app.authenticate);

  app.get('/', async (request, reply) => {
    const { organizationId } = request.user;
    const parsed = expoListQuerySchema.safeParse(request.query);
    if (!parsed.success) {
      return reply.status(400).send({ error: parsed.error.flatten() });
    }
    const expos = await listExpos(organizationId, parsed.data);
    return { expos };
  });

  app.post('/discover', { preHandler: requireManager() }, async (request, reply) => {
    const { organizationId } = request.user;
    const parsed = expoDiscoverSchema.safeParse(request.body ?? {});
    if (!parsed.success) {
      return reply.status(400).send({ error: parsed.error.flatten() });
    }
    try {
      const summary = await discoverExpos(organizationId, parsed.data.tier);
      return { summary };
    } catch (e) {
      if (e instanceof ExpoFinderUnavailableError) {
        return reply.status(503).send({ error: e.message, code: e.code });
      }
      throw e;
    }
  });

  app.post('/:id/add-to-calendar', async (request, reply) => {
    const { organizationId, sub: userId } = request.user;
    const { id } = request.params as { id: string };
    const parsed = expoAddToCalendarSchema.safeParse(request.body ?? {});
    if (!parsed.success) {
      return reply.status(400).send({ error: parsed.error.flatten() });
    }
    try {
      const result = await addExpoToCalendar(organizationId, userId, id, parsed.data.attendeeIds);
      if (!result) return reply.status(404).send({ error: 'Expo not found' });
      return result;
    } catch (e) {
      if (e instanceof ExpoNotDatedError) {
        return reply.status(409).send({ error: e.message, code: e.code });
      }
      throw e;
    }
  });

  /** Toggles: hide an expo you are not interested in, or bring it back. */
  app.post('/:id/dismiss', async (request, reply) => {
    const { organizationId } = request.user;
    const { id } = request.params as { id: string };
    const expo = await dismissExpo(id, organizationId);
    if (!expo) return reply.status(404).send({ error: 'Expo not found' });
    return { expo };
  });
};
