import type { FastifyPluginAsync } from 'fastify';
import { prisma } from '../lib/prisma.js';

/** Mobile push registration (VSM-SPEC §4.5 Phase 3). `token` is the native
 * FCM device token from Notifications.getDevicePushTokenAsync() on the
 * device — not an Expo push token, since sends go direct to FCM. */
export const pushTokenRoutes: FastifyPluginAsync = async (app) => {
  app.addHook('onRequest', app.authenticate);

  app.post('/', async (request, reply) => {
    const { sub: userId } = request.user;
    const body = (request.body ?? {}) as { token?: string; platform?: string };
    if (typeof body.token !== 'string' || body.token.length < 10) {
      return reply.status(400).send({ error: 'token is required' });
    }
    const platform = body.platform === 'ios' ? 'ios' : 'android';

    // A token belongs to whichever user most recently registered it — e.g.
    // a shared device that gets logged out and back in as someone else.
    const pushToken = await prisma.pushToken.upsert({
      where: { token: body.token },
      create: { userId, token: body.token, platform },
      update: { userId, platform, lastUsedAt: new Date() },
    });
    return reply.status(201).send({ pushToken });
  });

  app.delete('/', async (request, reply) => {
    const { sub: userId } = request.user;
    const body = (request.body ?? {}) as { token?: string };
    if (typeof body.token !== 'string') {
      return reply.status(400).send({ error: 'token is required' });
    }
    await prisma.pushToken.deleteMany({ where: { token: body.token, userId } });
    return reply.status(204).send();
  });
};
