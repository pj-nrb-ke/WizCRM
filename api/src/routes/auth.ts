import type { FastifyPluginAsync } from 'fastify';
import bcrypt from 'bcryptjs';
import { loginSchema } from '@wizcrm/shared';
import { prisma } from '../lib/prisma.js';
import { getOrganizationEntitlements } from '../services/entitlements.service.js';
import { requestGdprExport } from '../services/erp-sync.service.js';

export const authRoutes: FastifyPluginAsync = async (app) => {
  app.post('/login', async (request, reply) => {
    const parsed = loginSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.status(400).send({ error: 'Invalid credentials payload' });
    }

    const user = await prisma.user.findUnique({
      where: { email: parsed.data.email.toLowerCase() },
    });
    if (!user || !(await bcrypt.compare(parsed.data.password, user.passwordHash))) {
      return reply.status(401).send({ error: 'Invalid email or password' });
    }

    const token = await reply.jwtSign({
      sub: user.id,
      organizationId: user.organizationId,
      email: user.email,
      role: user.role,
    });

    const entitlements = await getOrganizationEntitlements(user.organizationId);

    return {
      token,
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        role: user.role,
        organizationId: user.organizationId,
      },
      entitlements,
    };
  });

  app.get('/me', { onRequest: [app.authenticate] }, async (request) => {
    const user = await prisma.user.findUnique({
      where: { id: request.user.sub },
      select: { id: true, email: true, name: true, role: true, organizationId: true },
    });
    if (!user) return { user: null };
    const entitlements = await getOrganizationEntitlements(user.organizationId);
    return { user, entitlements };
  });

  app.post('/gdpr-export-request', { onRequest: [app.authenticate] }, async (request) => {
    return requestGdprExport(request.user.organizationId);
  });
};
