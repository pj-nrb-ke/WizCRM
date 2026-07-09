import type { FastifyPluginAsync } from 'fastify';
import { config } from '../config.js';
import { prisma } from '../lib/prisma.js';
import { getBrevoStatus } from '../services/brevo-config.js';

/** Long enough for a healthy round-trip, short enough that a monitor never hangs. */
const DB_PING_TIMEOUT_MS = 3000;

async function pingDatabase(): Promise<boolean> {
  try {
    await Promise.race([
      prisma.$queryRaw`SELECT 1`,
      new Promise((_, reject) =>
        setTimeout(() => reject(new Error('db ping timed out')), DB_PING_TIMEOUT_MS),
      ),
    ]);
    return true;
  } catch {
    return false;
  }
}

export const healthRoutes: FastifyPluginAsync = async (app) => {
  /**
   * Public liveness probe, polled by the watchdog and any external monitor.
   *
   * It reaches the database on purpose: an API that answers "ok" while Postgres
   * is unreachable is worse than no health check at all, because it reports
   * healthy during exactly the outage you needed to hear about. A failing check
   * returns 503, so a monitor sees a non-2xx without having to parse the body.
   */
  app.get('/health', async (_request, reply) => {
    const email = getBrevoStatus();
    const dbUp = await pingDatabase();

    if (!dbUp) {
      return reply.status(503).send({
        status: 'degraded',
        db: 'down',
        uptimeSeconds: Math.round(process.uptime()),
      });
    }

    return {
      status: 'ok',
      db: 'up',
      uptimeSeconds: Math.round(process.uptime()),
      aiEnabled: config.aiEnabled,
      emailConfigured: email.configured,
      emailMethod: email.method,
    };
  });
};
