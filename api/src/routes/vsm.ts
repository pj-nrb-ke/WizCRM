import type { FastifyPluginAsync, FastifyReply, FastifyRequest } from 'fastify';
import { randomUUID } from 'node:crypto';
import bcrypt from 'bcryptjs';
import { updateVsmConfigSchema, upsertTeamMemberProfileSchema } from '@wizcrm/shared';
import { prisma } from '../lib/prisma.js';
import { getOrgSettings } from '../services/org-settings.service.js';

/**
 * Admin/CEO governance guard (VSM-SPEC §4.2b): roster, VSM config, and KPIs
 * are a management tool — only ADMIN role or a configured CEO user id may
 * touch them. CEO is a per-org user id list on VsmConfig, not a role, since
 * the CEO may not always hold the ADMIN account.
 */
async function requireAdminOrCeo() {
  return async (request: FastifyRequest, reply: FastifyReply) => {
    if (request.user.role === 'ADMIN') return;
    const cfg = await prisma.vsmConfig.findUnique({
      where: { organizationId: request.user.organizationId },
      select: { ceoUserIds: true },
    });
    if (cfg?.ceoUserIds.includes(request.user.sub)) return;
    return reply.status(403).send({ error: 'Admin or CEO only' });
  };
}

async function getOrCreateVsmConfig(organizationId: string) {
  const existing = await prisma.vsmConfig.findUnique({ where: { organizationId } });
  if (existing) return existing;
  return prisma.vsmConfig.create({ data: { organizationId } });
}

/** Diff-and-log: only fields actually present in the patch and actually changed get an audit row. */
async function applyConfigPatch(
  vsmConfigId: string,
  organizationId: string,
  current: Record<string, unknown>,
  patch: Record<string, unknown>,
  changedBy: string,
) {
  const changes: { field: string; oldValue: unknown; newValue: unknown }[] = [];
  for (const [field, newValue] of Object.entries(patch)) {
    if (newValue === undefined) continue;
    const oldValue = current[field];
    if (JSON.stringify(oldValue) !== JSON.stringify(newValue)) {
      changes.push({ field, oldValue, newValue });
    }
  }
  if (changes.length === 0) return [];
  await prisma.$transaction(
    changes.map((c) =>
      prisma.vsmConfigChange.create({
        data: {
          vsmConfigId,
          organizationId,
          field: c.field,
          oldValue: c.oldValue ?? undefined,
          newValue: c.newValue ?? undefined,
          changedBy,
        },
      }),
    ),
  );
  return changes;
}

export const vsmRoutes: FastifyPluginAsync = async (app) => {
  app.addHook('onRequest', app.authenticate);

  // ─── Roster ────────────────────────────────────────────────────────────

  app.get('/roster', { preHandler: await requireAdminOrCeo() }, async (request) => {
    const users = await prisma.user.findMany({
      where: { organizationId: request.user.organizationId, isVirtual: false },
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        team: { select: { id: true, name: true } },
        teamMemberProfile: true,
      },
      orderBy: { name: 'asc' },
    });
    return { roster: users };
  });

  app.put('/roster/:userId', { preHandler: await requireAdminOrCeo() }, async (request, reply) => {
    const { userId } = request.params as { userId: string };
    const parsed = upsertTeamMemberProfileSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.status(400).send({ error: parsed.error.flatten() });
    }
    const user = await prisma.user.findFirst({
      where: { id: userId, organizationId: request.user.organizationId, isVirtual: false },
    });
    if (!user) return reply.status(404).send({ error: 'User not found' });

    const profile = await prisma.teamMemberProfile.upsert({
      where: { userId },
      create: { organizationId: request.user.organizationId, userId, ...parsed.data },
      update: { ...parsed.data },
    });
    return { profile };
  });

  // ─── VSM configuration (§4.2, §4.2a, §4.2b) ───────────────────────────────

  app.get('/config', { preHandler: await requireAdminOrCeo() }, async (request) => {
    const cfg = await getOrCreateVsmConfig(request.user.organizationId);
    return { config: cfg };
  });

  app.patch('/config', { preHandler: await requireAdminOrCeo() }, async (request, reply) => {
    const parsed = updateVsmConfigSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.status(400).send({ error: parsed.error.flatten() });
    }
    const cfg = await getOrCreateVsmConfig(request.user.organizationId);
    if (parsed.data.ceoUserIds) {
      const count = await prisma.user.count({
        where: { id: { in: parsed.data.ceoUserIds }, organizationId: request.user.organizationId },
      });
      if (count !== parsed.data.ceoUserIds.length) {
        return reply.status(400).send({ error: 'ceoUserIds must be users in this organization' });
      }
    }
    await applyConfigPatch(
      cfg.id,
      request.user.organizationId,
      cfg as unknown as Record<string, unknown>,
      parsed.data as Record<string, unknown>,
      request.user.sub,
    );
    const updated = await prisma.vsmConfig.update({
      where: { id: cfg.id },
      data: parsed.data,
    });
    return { config: updated };
  });

  app.get('/config/changes', { preHandler: await requireAdminOrCeo() }, async (request) => {
    const changes = await prisma.vsmConfigChange.findMany({
      where: { organizationId: request.user.organizationId },
      orderBy: { at: 'desc' },
      take: 100,
      include: { changedByUser: { select: { id: true, name: true, email: true } } },
    });
    return { changes };
  });

  // Provision the VSM's own system user (isVirtual=true, MANAGER) once, and
  // link it to VsmConfig. Login is impossible: the hash is a random value
  // whose plaintext is never stored or returned, matching the bcrypt/12
  // convention used everywhere else so passwordHash stays a real hash.
  app.post('/provision', { preHandler: await requireAdminOrCeo() }, async (request) => {
    const cfg = await getOrCreateVsmConfig(request.user.organizationId);
    if (cfg.vsmUserId) {
      const existing = await prisma.user.findUnique({ where: { id: cfg.vsmUserId } });
      if (existing) return { user: existing, config: cfg };
    }
    const passwordHash = await bcrypt.hash(randomUUID() + randomUUID(), 12);
    const vsmUser = await prisma.user.create({
      data: {
        organizationId: request.user.organizationId,
        email: cfg.personaEmail,
        name: cfg.personaName,
        passwordHash,
        role: 'MANAGER',
        isVirtual: true,
      },
    });
    const updated = await prisma.vsmConfig.update({
      where: { id: cfg.id },
      data: { vsmUserId: vsmUser.id },
    });
    return { user: vsmUser, config: updated };
  });

  // ─── Dry run (Phase 0 accept criterion) ───────────────────────────────────
  // Deterministic rule layer only — no LLM ranking, no sends. Enough to prove
  // the evidence-linked-candidate shape end to end before Phase 1 wires up
  // prioritisation, phrasing, and actual task creation/email.

  app.post('/dry-run', { preHandler: await requireAdminOrCeo() }, async (request) => {
    const { organizationId } = request.user;
    const settings = await getOrgSettings(organizationId);
    const staleLeadDays = settings.staleLeadDays ?? 7;
    const staleCutoff = new Date(Date.now() - staleLeadDays * 24 * 60 * 60 * 1000);
    const newLeadCutoff = new Date(Date.now() - 24 * 60 * 60 * 1000);
    const now = new Date();

    const [staleLeads, overdueTasks, unworkedLeads] = await Promise.all([
      // R1 — stale lead in an active (non-terminal) stage
      prisma.lead.findMany({
        where: {
          organizationId,
          stage: { notIn: ['WON', 'LOST'] },
          OR: [{ lastActivityAt: { lt: staleCutoff } }, { lastActivityAt: null, createdAt: { lt: staleCutoff } }],
        },
        select: { id: true, name: true, company: true, stage: true, ownerId: true, lastActivityAt: true },
        take: 200,
      }),
      // R2 — overdue task
      prisma.task.findMany({
        where: { organizationId, completedAt: null, dueAt: { lt: now } },
        select: { id: true, title: true, userId: true, dueAt: true, leadId: true },
        take: 200,
      }),
      // R3 — new lead unworked >24h (no activity logged yet)
      prisma.lead.findMany({
        where: { organizationId, createdAt: { lt: newLeadCutoff }, activities: { none: {} } },
        select: { id: true, name: true, company: true, ownerId: true, createdAt: true },
        take: 200,
      }),
    ]);

    const candidates = [
      ...staleLeads.map((l) => ({
        rule: 'R1_STALE_LEAD',
        assigneeUserId: l.ownerId,
        title: `Follow up: ${l.name}${l.company ? ` (${l.company})` : ''}`,
        reason: `No activity since ${l.lastActivityAt?.toISOString().slice(0, 10) ?? 'lead creation'} — stage ${l.stage}`,
        evidence: { leadId: l.id, stage: l.stage, lastActivityAt: l.lastActivityAt },
      })),
      ...overdueTasks.map((t) => ({
        rule: 'R2_OVERDUE_TASK',
        assigneeUserId: t.userId,
        title: `Overdue: ${t.title}`,
        reason: `Was due ${t.dueAt?.toISOString().slice(0, 10)}`,
        evidence: { taskId: t.id, leadId: t.leadId, dueAt: t.dueAt },
      })),
      ...unworkedLeads.map((l) => ({
        rule: 'R3_NEW_LEAD_UNWORKED',
        assigneeUserId: l.ownerId,
        title: `First touch: ${l.name}${l.company ? ` (${l.company})` : ''}`,
        reason: `Created ${l.createdAt.toISOString().slice(0, 10)}, no activity logged yet`,
        evidence: { leadId: l.id, createdAt: l.createdAt },
      })),
    ];

    const cfg = await getOrCreateVsmConfig(organizationId);
    return {
      generatedAt: now.toISOString(),
      candidateCount: candidates.length,
      taskCapPerDay: cfg.taskCapPerDay,
      candidates,
    };
  });

  // ─── Inbound email (two-way channel on reply.wizag.co.ke) ────────────────
  // Unmatched rows have no organizationId (we don't know the org until a
  // match is found), so this can't be org-scoped like everything else here —
  // gated to admin/CEO instead, matching the sensitivity of reading raw mail.

  app.get('/inbound-emails', { preHandler: await requireAdminOrCeo() }, async (request) => {
    const { filter } = request.query as { filter?: 'matched' | 'unmatched' };
    const where =
      filter === 'matched' ? { matchedTaskId: { not: null } } : filter === 'unmatched' ? { matchedTaskId: null } : {};
    const emails = await prisma.inboundEmail.findMany({
      where,
      orderBy: { receivedAt: 'desc' },
      take: 100,
      select: {
        id: true,
        fromEmail: true,
        fromName: true,
        toEmail: true,
        subject: true,
        bodyText: true,
        matchedTaskId: true,
        matchedUserId: true,
        matchedUser: { select: { name: true, email: true } },
        receivedAt: true,
      },
    });
    return { emails };
  });

  // ─── Notifications (in-app feed) ──────────────────────────────────────────

  app.get('/notifications', async (request) => {
    const notifications = await prisma.notification.findMany({
      where: { organizationId: request.user.organizationId, userId: request.user.sub },
      orderBy: { createdAt: 'desc' },
      take: 50,
    });
    return { notifications };
  });

  app.post('/notifications/:id/read', async (request, reply) => {
    const { id } = request.params as { id: string };
    const existing = await prisma.notification.findFirst({
      where: { id, organizationId: request.user.organizationId, userId: request.user.sub },
    });
    if (!existing) return reply.status(404).send({ error: 'Notification not found' });
    const notification = await prisma.notification.update({
      where: { id },
      data: { readAt: new Date() },
    });
    return { notification };
  });
};
