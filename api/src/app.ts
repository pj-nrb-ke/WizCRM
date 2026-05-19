import Fastify from 'fastify';
import cors from '@fastify/cors';
import jwt from '@fastify/jwt';
import { config } from './config.js';
import { authRoutes } from './routes/auth.js';
import { leadRoutes } from './routes/leads.js';
import { activityRoutes } from './routes/activities.js';
import { taskRoutes } from './routes/tasks.js';
import { aiRoutes } from './routes/ai.js';
import { healthRoutes } from './routes/health.js';

export async function buildApp() {
  const app = Fastify({
    logger: true,
    // Business card photos are sent as base64 from the mobile app.
    bodyLimit: 15 * 1024 * 1024,
  });

  await app.register(cors, { origin: true });
  await app.register(jwt, { secret: config.jwtSecret });

  app.decorate('authenticate', async (request, reply) => {
    try {
      await request.jwtVerify();
    } catch {
      return reply.status(401).send({ error: 'Unauthorized' });
    }
  });

  await app.register(healthRoutes);
  await app.register(authRoutes, { prefix: '/auth' });
  await app.register(leadRoutes, { prefix: '/leads' });
  await app.register(activityRoutes, { prefix: '/leads' });
  await app.register(taskRoutes, { prefix: '/tasks' });
  await app.register(aiRoutes, { prefix: '/ai' });

  app.setErrorHandler((error, _request, reply) => {
    const err = error as Error & { statusCode?: number };
    if (err.message === 'AI_UNAVAILABLE') {
      return reply.status(503).send({
        error: 'AI_UNAVAILABLE',
        message: 'Set OPENAI_API_KEY to enable AI features',
      });
    }
    const status = err.statusCode ?? 500;
    app.log.error(error);
    return reply.status(status).send({
      error: err.message ?? 'Internal Server Error',
    });
  });

  return app;
}
