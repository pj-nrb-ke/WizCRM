import type { FastifyPluginAsync, FastifyReply, FastifyRequest } from 'fastify';
import bcrypt from 'bcryptjs';
import {
  createAdminUserSchema,
  orgSettingsSchema,
  updateAdminUserSchema,
  updateOrganizationSchema,
  type OrgSettings,
} from '@wizcrm/shared';
import { config } from '../config.js';
import { getErrorReport } from '../lib/error-recorder.js';
import { prisma } from '../lib/prisma.js';
import {
  getOrgSettings,
  mergeOrgSettings,
  resolveDeskUseAi,
} from '../services/org-settings.service.js';
import { randomBytes } from 'node:crypto';
import { disableWebhook, enableWebhook } from '../services/webhook.service.js';
import { sendAccountActivationEmail, sendPasswordResetEmail } from '../services/auth-email.service.js';
import { createPasswordResetToken, ACCOUNT_ACTIVATION_TTL_MS, FORGOT_PASSWORD_TTL_MS } from '../services/password-reset.service.js';

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

/** True if `userId` is the org's only remaining active admin — losing them would lock the org out. */
async function isLastActiveAdmin(organizationId: string, userId: string): Promise<boolean> {
  const target = await prisma.user.findUnique({ where: { id: userId } });
  if (!target || target.role !== 'ADMIN') return false;
  const otherActiveAdmins = await prisma.user.count({
    where: { organizationId, role: 'ADMIN', isActive: true, id: { not: userId } },
  });
  return otherActiveAdmins === 0;
}

const USER_SELECT = {
  id: true,
  email: true,
  name: true,
  role: true,
  teamId: true,
  isActive: true,
  createdAt: true,
  team: { select: { id: true, name: true } },
} as const;

export const adminRoutes: FastifyPluginAsync = async (app) => {
  app.addHook('onRequest', app.authenticate);

  /** Recent 5xx failures, for triage after the watchdog has already shouted. */
  app.get('/errors', { preHandler: requireManager() }, async () => {
    return getErrorReport();
  });

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

  app.get('/organization', { preHandler: requireAdmin() }, async (request) => {
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
      where: { organizationId: request.user.organizationId, isVirtual: false },
      select: USER_SELECT,
      orderBy: { name: 'asc' },
    });
    return { users };
  });

  app.post('/users', { preHandler: requireAdmin() }, async (request, reply) => {
    const parsed = createAdminUserSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.status(400).send({ error: parsed.error.flatten() });
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
    // No password is set by the admin or exposed anywhere — a random,
    // never-revealed value fills the (required) column, and the new user
    // sets their own password via the activation-link email below.
    const passwordHash = await bcrypt.hash(randomBytes(32).toString('hex'), 12);
    const user = await prisma.user.create({
      data: {
        organizationId: request.user.organizationId,
        email,
        name: parsed.data.name.trim(),
        passwordHash,
        role: parsed.data.role,
        teamId: parsed.data.teamId ?? null,
      },
      select: USER_SELECT,
    });
    const rawToken = await createPasswordResetToken(user.id, ACCOUNT_ACTIVATION_TTL_MS);
    sendAccountActivationEmail({ toEmail: user.email, toName: user.name, rawToken });
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
    if (parsed.data.role && parsed.data.role !== 'ADMIN' && (await isLastActiveAdmin(request.user.organizationId, id))) {
      return reply.status(409).send({ error: 'This is the only remaining admin — promote someone else first.' });
    }
    const user = await prisma.user.update({
      where: { id },
      data: {
        name: parsed.data.name?.trim(),
        role: parsed.data.role,
        teamId: parsed.data.teamId === undefined ? undefined : parsed.data.teamId,
      },
      select: USER_SELECT,
    });
    return { user };
  });

  // Admin-triggered password reset — sends the same link-based flow as
  // self-service "forgot password" rather than the admin choosing a
  // password on the user's behalf.
  app.post('/users/:id/reset-password', { preHandler: requireAdmin() }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const target = await prisma.user.findFirst({
      where: { id, organizationId: request.user.organizationId },
    });
    if (!target) return reply.status(404).send({ error: 'User not found' });

    const rawToken = await createPasswordResetToken(target.id, FORGOT_PASSWORD_TTL_MS);
    sendPasswordResetEmail({ toEmail: target.email, toName: target.name, rawToken });
    return { ok: true };
  });

  // Deactivate — blocks login immediately, drops the user out of the VSM
  // roster, but keeps their name attached to every lead/task/activity they
  // ever touched. This is the primary offboarding action.
  app.post('/users/:id/deactivate', { preHandler: requireAdmin() }, async (request, reply) => {
    const { id } = request.params as { id: string };
    if (id === request.user.sub) {
      return reply.status(400).send({ error: "You can't deactivate your own account." });
    }
    const target = await prisma.user.findFirst({
      where: { id, organizationId: request.user.organizationId },
    });
    if (!target) return reply.status(404).send({ error: 'User not found' });
    if (await isLastActiveAdmin(request.user.organizationId, id)) {
      return reply.status(409).send({ error: 'This is the only remaining admin — promote someone else first.' });
    }
    const user = await prisma.user.update({ where: { id }, data: { isActive: false }, select: USER_SELECT });
    return { user };
  });

  app.post('/users/:id/reactivate', { preHandler: requireAdmin() }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const target = await prisma.user.findFirst({
      where: { id, organizationId: request.user.organizationId },
    });
    if (!target) return reply.status(404).send({ error: 'User not found' });
    const user = await prisma.user.update({ where: { id }, data: { isActive: true }, select: USER_SELECT });
    return { user };
  });

  // Hard delete — only succeeds for accounts with no associated records
  // (leads, tasks, activity history, etc.), so real work history is never
  // silently destroyed. Use deactivate for anyone who's actually used the
  // system.
  app.delete('/users/:id', { preHandler: requireAdmin() }, async (request, reply) => {
    const { id } = request.params as { id: string };
    if (id === request.user.sub) {
      return reply.status(400).send({ error: "You can't delete your own account." });
    }
    const target = await prisma.user.findFirst({
      where: { id, organizationId: request.user.organizationId },
    });
    if (!target) return reply.status(404).send({ error: 'User not found' });
    if (await isLastActiveAdmin(request.user.organizationId, id)) {
      return reply.status(409).send({ error: 'This is the only remaining admin — promote someone else first.' });
    }
    try {
      await prisma.user.delete({ where: { id } });
      return reply.status(204).send();
    } catch {
      return reply.status(409).send({
        error: `${target.name} has existing leads, tasks, or activity history and can't be deleted. Deactivate the account instead to preserve that history.`,
      });
    }
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

  // ─── Lead Engine — Data Sources settings ────────────────────────────────────
  // Each org supplies its own provider accounts (api-keys sub-object below) —
  // there is no shared/global key any org can silently inherit.

  const PROVIDER_KEY_FIELDS: Record<string, keyof NonNullable<OrgSettings['apiKeys']>> = {
    apify: 'apifyToken',
    firecrawl: 'firecrawlApiKey',
    apollo: 'apolloApiKey',
    hunter: 'hunterApiKey',
    tavily: 'tavilyApiKey',
    opencorporates: 'openCorporatesApiKey',
  };

  const PROVIDER_DEFAULTS: Record<string, boolean> = {
    apify: true,
    firecrawl: true,
    apollo: false,
    hunter: false,
    tavily: false,
    opencorporates: false,
  };

  app.get('/settings/lead-engine', { preHandler: requireAdmin() }, async (request) => {
    const settings = await getOrgSettings(request.user.organizationId);
    const org = await prisma.organization.findUnique({
      where: { id: request.user.organizationId },
      select: { settings: true },
    });
    const rawSettings = (org?.settings ?? {}) as Record<string, unknown>;
    const stored = (rawSettings.leadEngine ?? {}) as Record<string, unknown>;
    const storedProviders = (stored.providers ?? {}) as Record<string, { enabled: boolean }>;

    const providers: Record<string, { enabled: boolean; configured: boolean }> = {};
    for (const [id, field] of Object.entries(PROVIDER_KEY_FIELDS)) {
      const configured = Boolean(settings.apiKeys?.[field]);
      const defaultOn = PROVIDER_DEFAULTS[id] ?? false;
      const storedEnabled = storedProviders[id]?.enabled ?? defaultOn;
      providers[id] = { enabled: storedEnabled && configured, configured };
    }

    return {
      providers,
      globalLimit: (stored.globalLimit as number | undefined) ?? 20,
      apiKeys: settings.apiKeys ?? {},
    };
  });

  app.put('/settings/lead-engine', { preHandler: requireAdmin() }, async (request, reply) => {
    const body = request.body as {
      providers?: Record<string, { enabled: boolean }>;
      globalLimit?: number;
      apiKeys?: Record<string, string>;
    };
    if (!body || typeof body !== 'object') {
      return reply.status(400).send({ error: 'Invalid body' });
    }

    const apiKeysPatch: Record<string, string> = {};
    if (body.apiKeys && typeof body.apiKeys === 'object') {
      for (const field of Object.values(PROVIDER_KEY_FIELDS)) {
        if (typeof body.apiKeys[field] === 'string') {
          apiKeysPatch[field] = body.apiKeys[field].trim().slice(0, 500);
        }
      }
    }
    const mergedSettings = await mergeOrgSettings(request.user.organizationId, {
      apiKeys: apiKeysPatch,
    });

    const safeProviders: Record<string, { enabled: boolean }> = {};
    for (const [id, field] of Object.entries(PROVIDER_KEY_FIELDS)) {
      if (body.providers && id in body.providers) {
        const configured = Boolean(mergedSettings.apiKeys?.[field]);
        safeProviders[id] = { enabled: Boolean(body.providers[id].enabled) && configured };
      }
    }

    const globalLimit = Math.min(Math.max(Number(body.globalLimit ?? 20), 1), 100);

    // Re-fetch after the apiKeys merge above so this write doesn't clobber it.
    const org = await prisma.organization.findUnique({
      where: { id: request.user.organizationId },
      select: { settings: true },
    });
    const current = (org?.settings ?? {}) as Record<string, unknown>;
    await prisma.organization.update({
      where: { id: request.user.organizationId },
      data: {
        settings: {
          ...current,
          leadEngine: { providers: safeProviders, globalLimit, updatedAt: new Date().toISOString() },
        },
      },
    });

    return { providers: safeProviders, globalLimit, apiKeys: mergedSettings.apiKeys ?? {} };
  });

};
