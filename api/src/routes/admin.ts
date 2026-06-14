import type { FastifyPluginAsync, FastifyReply, FastifyRequest } from 'fastify';
import bcrypt from 'bcryptjs';
import zxcvbn from 'zxcvbn';
import {
  createAdminUserSchema,
  orgSettingsSchema,
  updateAdminUserSchema,
  updateOrganizationSchema,
} from '@wizcrm/shared';
import { config } from '../config.js';
import { prisma } from '../lib/prisma.js';
import {
  getOrgSettings,
  mergeOrgSettings,
  resolveDeskUseAi,
} from '../services/org-settings.service.js';
import { disableWebhook, enableWebhook } from '../services/webhook.service.js';

function isAdmin(role: string) {
  return role === 'ADMIN';
}

function isManager(role: string) {
  return role === 'MANAGER' || role === 'ADMIN';
}

function requireAdmin() {
  return async (request: FastifyRequest, reply: FastifyReply) => {
    if (!isAdmin(request.user.role)) {
      return reply.status(403).send({ error: 'Admin only' });
    }
  };
}

function requireManager() {
  return async (request: FastifyRequest, reply: FastifyReply) => {
    if (!isManager(request.user.role)) {
      return reply.status(403).send({ error: 'Managers and admins only' });
    }
  };
}

export const adminRoutes: FastifyPluginAsync = async (app) => {
  app.addHook('onRequest', app.authenticate);

  app.get('/health', { preHandler: requireManager() }, async (request) => {
    const { organizationId } = request.user;
    const deskUseAi = await resolveDeskUseAi(organizationId);
    const settings = await getOrgSettings(organizationId);
    return {
      status: 'ok',
      aiEnabled: config.aiEnabled,
      deskUseAi,
      deskUseAiEnvDefault: config.deskUseAi,
      organizationSettings: settings,
      apiPublicUrl: process.env.PUBLIC_API_URL ?? 'https://api.wizcrm.app',
      webPublicUrl: process.env.PUBLIC_WEB_URL ?? 'https://app.wizcrm.app',
      openaiModel: config.openaiModel,
      nodeEnv: process.env.NODE_ENV ?? 'development',
    };
  });

  app.get('/organization', { preHandler: requireManager() }, async (request) => {
    const org = await prisma.organization.findUnique({
      where: { id: request.user.organizationId },
      select: { id: true, name: true, settings: true, createdAt: true },
    });
    if (!org) return { organization: null };
    const settings = await getOrgSettings(org.id);
    const deskUseAi = await resolveDeskUseAi(org.id);
    return {
      organization: {
        id: org.id,
        name: org.name,
        createdAt: org.createdAt,
        settings,
        deskUseAi,
      },
    };
  });

  app.patch('/organization', { preHandler: requireAdmin() }, async (request, reply) => {
    const parsed = updateOrganizationSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.status(400).send({ error: parsed.error.flatten() });
    }
    const org = await prisma.organization.update({
      where: { id: request.user.organizationId },
      data: { name: parsed.data.name.trim() },
      select: { id: true, name: true, createdAt: true },
    });
    const settings = await getOrgSettings(org.id);
    return {
      organization: { ...org, settings, deskUseAi: await resolveDeskUseAi(org.id) },
    };
  });

  app.get('/settings', { preHandler: requireAdmin() }, async (request) => {
    const settings = await getOrgSettings(request.user.organizationId);
    return {
      settings,
      deskUseAi: await resolveDeskUseAi(request.user.organizationId),
      deskUseAiEnvDefault: config.deskUseAi,
      aiEnabled: config.aiEnabled,
      openaiKeyConfigured: config.aiEnabled,
      openaiModel: config.openaiModel,
    };
  });

  app.patch('/settings', { preHandler: requireAdmin() }, async (request, reply) => {
    const parsed = orgSettingsSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.status(400).send({ error: parsed.error.flatten() });
    }
    const settings = await mergeOrgSettings(request.user.organizationId, parsed.data);
    return {
      settings,
      deskUseAi: await resolveDeskUseAi(request.user.organizationId),
    };
  });

  app.get('/users', { preHandler: requireAdmin() }, async (request) => {
    const users = await prisma.user.findMany({
      where: { organizationId: request.user.organizationId },
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
        teamId: true,
        createdAt: true,
        team: { select: { id: true, name: true } },
      },
      orderBy: { name: 'asc' },
    });
    return { users };
  });

  app.post('/users', { preHandler: requireAdmin() }, async (request, reply) => {
    const parsed = createAdminUserSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.status(400).send({ error: parsed.error.flatten() });
    }
    // NIST 800-63B style strength check: reject weak/common/context-derived
    // passwords (dictionary words, the user's own name/email, keyboard walks).
    const strength = zxcvbn(parsed.data.password, [parsed.data.email, parsed.data.name, 'wizcrm']);
    if (strength.score < 3) {
      return reply.status(400).send({
        error:
          strength.feedback.warning ||
          'Password is too weak or common. Use a longer, less predictable passphrase.',
        suggestions: strength.feedback.suggestions,
      });
    }
    const email = parsed.data.email.toLowerCase().trim();
    const existing = await prisma.user.findUnique({ where: { email } });
    if (existing) {
      return reply.status(409).send({ error: 'Email already in use' });
    }
    if (parsed.data.teamId) {
      const team = await prisma.team.findFirst({
        where: { id: parsed.data.teamId, organizationId: request.user.organizationId },
      });
      if (!team) return reply.status(400).send({ error: 'Invalid team' });
    }
    const passwordHash = await bcrypt.hash(parsed.data.password, 12);
    const user = await prisma.user.create({
      data: {
        organizationId: request.user.organizationId,
        email,
        name: parsed.data.name.trim(),
        passwordHash,
        role: parsed.data.role,
        teamId: parsed.data.teamId ?? null,
      },
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
        teamId: true,
        createdAt: true,
        team: { select: { id: true, name: true } },
      },
    });
    return reply.status(201).send({ user });
  });

  app.patch('/users/:id', { preHandler: requireAdmin() }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const parsed = updateAdminUserSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.status(400).send({ error: parsed.error.flatten() });
    }
    const existing = await prisma.user.findFirst({
      where: { id, organizationId: request.user.organizationId },
    });
    if (!existing) return reply.status(404).send({ error: 'User not found' });
    if (parsed.data.teamId) {
      const team = await prisma.team.findFirst({
        where: { id: parsed.data.teamId, organizationId: request.user.organizationId },
      });
      if (!team) return reply.status(400).send({ error: 'Invalid team' });
    }
    const user = await prisma.user.update({
      where: { id },
      data: {
        name: parsed.data.name?.trim(),
        role: parsed.data.role,
        teamId: parsed.data.teamId === undefined ? undefined : parsed.data.teamId,
      },
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
        teamId: true,
        createdAt: true,
        team: { select: { id: true, name: true } },
      },
    });
    return { user };
  });

  app.get('/teams', { preHandler: requireManager() }, async (request) => {
    const teams = await prisma.team.findMany({
      where: { organizationId: request.user.organizationId },
      include: {
        members: {
          select: { id: true, name: true, email: true, role: true },
          orderBy: { name: 'asc' },
        },
      },
      orderBy: { name: 'asc' },
    });
    return {
      teams: teams.map((t) => ({
        id: t.id,
        name: t.name,
        memberCount: t.members.length,
        members: t.members,
      })),
    };
  });

  app.get('/audit', { preHandler: requireAdmin() }, async (request) => {
    const logs = await prisma.aiAuditLog.findMany({
      where: { organizationId: request.user.organizationId },
      orderBy: { createdAt: 'desc' },
      take: 20,
      select: {
        id: true,
        feature: true,
        model: true,
        inputSummary: true,
        outputSummary: true,
        approved: true,
        createdAt: true,
        user: { select: { name: true, email: true } },
      },
    });
    return { logs };
  });

  app.get('/integrations/webhook', { preHandler: requireAdmin() }, async (request) => {
    const settings = await getOrgSettings(request.user.organizationId);
    const base = (process.env.PUBLIC_API_URL ?? 'https://api.wizcrm.app').replace(/\/$/, '');
    return {
      enabled: Boolean(settings.webhookEnabled),
      hasSecret: Boolean(settings.webhookSecret),
      endpoint: `${base}/integrations/webhook/leads`,
    };
  });

  app.post('/integrations/webhook/enable', { preHandler: requireAdmin() }, async (request) => {
    const secret = await enableWebhook(request.user.organizationId);
    const base = (process.env.PUBLIC_API_URL ?? 'https://api.wizcrm.app').replace(/\/$/, '');
    return {
      secret,
      enabled: true,
      endpoint: `${base}/integrations/webhook/leads`,
    };
  });

  app.post('/integrations/webhook/disable', { preHandler: requireAdmin() }, async (request) => {
    await disableWebhook(request.user.organizationId);
    return { ok: true, enabled: false };
  });

  app.get('/integrations/erp', { preHandler: requireAdmin() }, async (request) => {
    const { getErpConnectorStatus } = await import('../services/erp-sync.service.js');
    const status = await getErpConnectorStatus(request.user.organizationId);
    return status;
  });

};
