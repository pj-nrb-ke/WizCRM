import type { FastifyPluginAsync } from 'fastify';
import { config } from '../config.js';
import { getBrevoStatus } from '../services/brevo-config.js';

export const healthRoutes: FastifyPluginAsync = async (app) => {
  app.get('/health', async () => {
    const email = getBrevoStatus();
    return {
      status: 'ok',
      aiEnabled: config.aiEnabled,
      emailConfigured: email.configured,
      emailMethod: email.method,
    };
  });
};
