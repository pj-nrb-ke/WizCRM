import type { FastifyPluginAsync, FastifyReply, FastifyRequest } from 'fastify';
import { randomUUID } from 'node:crypto';
import bcrypt from 'bcryptjs';
import { updateVsmConfigSchema, upsertTeamMemberProfileSchema } from '@wizcrm/shared';
import { prisma } from '../lib/prisma.js';
import { generateMorningPlan } from '../services/vsm-planning.service.js';
import {
  getOrCreateEodRun,
  getOrCreateMorningRun,
  sendMorningRun,
  skipMorningRun,
  updateMorningRunPlan,
} from '../services/vsm-execution.service.js';
import { getOrCreateWeeklyRun } from '../services/vsm-weekly.service.js';
import { computeAutoModeEligibility, computeVsmPerformance } from '../services/vsm-performance.service.js';

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

  // ─── VSM Performance page (§4.2a) — actual vs. target, and the evidence
  // base for the draft → auto decision (§4.2b) ──────────────────────────────

  app.get('/performance', { preHandler: await requireAdminOrCeo() }, async (request) => {
    const cfg = await getOrCreateVsmConfig(request.user.organizationId);
    const performance = await computeVsmPerformance(request.user.organizationId);
    return { performance, kpiTargets: cfg.kpiTargets };
  });

  app.get('/auto-mode-eligibility', { preHandler: await requireAdminOrCeo() }, async (request) => {
    const eligibility = await computeAutoModeEligibility(request.user.organizationId);
    return { eligibility };
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

  // ─── Dry run ───────────────────────────────────────────────────────────────
  // Previews the SAME curated plan a real morning run would produce — the
  // org-wide top-N focus list, not the raw rule-layer candidate dump (that
  // used to be what this returned, and it was misleading: with hundreds of
  // stale-but-low-priority leads in the seed data it looked like the whole
  // pile was about to become tasks, when the real run always curates down to
  // dailyFocusCap regardless). No Tasks created, no emails sent either way.

  app.post('/dry-run', { preHandler: await requireAdminOrCeo() }, async (request) => {
    const { organizationId } = request.user;
    const cfg = await getOrCreateVsmConfig(organizationId);
    const plan = await generateMorningPlan(organizationId, cfg);
    return plan;
  });

  // ─── Morning run + CEO approval (Phase 1) ─────────────────────────────────

  app.post('/runs/morning', { preHandler: await requireAdminOrCeo() }, async (request, reply) => {
    try {
      const run = await getOrCreateMorningRun(request.user.organizationId);
      return reply.status(201).send({ run });
    } catch (err) {
      if (err instanceof Error && err.message === 'VSM_NOT_ENABLED') {
        return reply.status(400).send({ error: 'Enable VSM in configuration before running the morning plan.' });
      }
      throw err;
    }
  });

  app.get('/runs', { preHandler: await requireAdminOrCeo() }, async (request) => {
    const { kind, status } = request.query as { kind?: 'MORNING' | 'EOD' | 'WEEKLY'; status?: string };
    const runs = await prisma.vsmRun.findMany({
      where: {
        organizationId: request.user.organizationId,
        kind: kind ?? undefined,
        status: (status as 'DRAFT' | 'APPROVED' | 'SENT' | 'SKIPPED' | undefined) ?? undefined,
      },
      orderBy: { date: 'desc' },
      take: 30,
    });
    return { runs };
  });

  app.get('/runs/:id', { preHandler: await requireAdminOrCeo() }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const run = await prisma.vsmRun.findFirst({ where: { id, organizationId: request.user.organizationId } });
    if (!run) return reply.status(404).send({ error: 'Run not found' });
    return { run };
  });

  app.patch('/runs/:id', { preHandler: await requireAdminOrCeo() }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const existing = await prisma.vsmRun.findFirst({ where: { id, organizationId: request.user.organizationId } });
    if (!existing) return reply.status(404).send({ error: 'Run not found' });
    const body = request.body as { people?: unknown };
    if (!Array.isArray(body.people)) return reply.status(400).send({ error: 'people[] required' });
    try {
      const run = await updateMorningRunPlan(id, body.people as never);
      return { run };
    } catch (err) {
      if (err instanceof Error && err.message === 'RUN_NOT_EDITABLE') {
        return reply.status(409).send({ error: 'Run is no longer editable — it has already been approved.' });
      }
      throw err;
    }
  });

  app.post('/runs/:id/approve', { preHandler: await requireAdminOrCeo() }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const existing = await prisma.vsmRun.findFirst({ where: { id, organizationId: request.user.organizationId } });
    if (!existing) return reply.status(404).send({ error: 'Run not found' });
    const run = await sendMorningRun(id, request.user.sub);
    return { run };
  });

  app.post('/runs/:id/skip', { preHandler: await requireAdminOrCeo() }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const existing = await prisma.vsmRun.findFirst({ where: { id, organizationId: request.user.organizationId } });
    if (!existing) return reply.status(404).send({ error: 'Run not found' });
    if (existing.status !== 'DRAFT') return reply.status(409).send({ error: 'Only a draft run can be skipped.' });
    const run = await skipMorningRun(id);
    return { run };
  });

  app.post('/runs/eod', { preHandler: await requireAdminOrCeo() }, async (request, reply) => {
    try {
      const run = await getOrCreateEodRun(request.user.organizationId);
      return reply.status(201).send({ run });
    } catch (err) {
      if (err instanceof Error && err.message === 'VSM_NOT_ENABLED') {
        return reply.status(400).send({ error: 'Enable VSM in configuration before running the evening digest.' });
      }
      throw err;
    }
  });

  app.post('/runs/weekly', { preHandler: await requireAdminOrCeo() }, async (request, reply) => {
    try {
      const run = await getOrCreateWeeklyRun(request.user.organizationId);
      return reply.status(201).send({ run });
    } catch (err) {
      if (err instanceof Error && err.message === 'VSM_NOT_ENABLED') {
        return reply.status(400).send({ error: 'Enable VSM in configuration before running the weekly review.' });
      }
      throw err;
    }
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

  // ─── Escalations (VSM-SPEC §4.7) — CEO inbox ──────────────────────────────

  app.get('/escalations', { preHandler: await requireAdminOrCeo() }, async (request) => {
    const { status } = request.query as { status?: 'OPEN' | 'ACKNOWLEDGED' | 'RESOLVED' };
    const escalations = await prisma.vsmEscalation.findMany({
      where: { organizationId: request.user.organizationId, status: status ?? undefined },
      orderBy: [{ severity: 'desc' }, { createdAt: 'desc' }],
      take: 100,
      include: {
        subjectUser: { select: { id: true, name: true } },
        acknowledgedByUser: { select: { id: true, name: true } },
        resolvedByUser: { select: { id: true, name: true } },
      },
    });
    return { escalations };
  });

  app.post('/escalations/:id/acknowledge', { preHandler: await requireAdminOrCeo() }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const existing = await prisma.vsmEscalation.findFirst({ where: { id, organizationId: request.user.organizationId } });
    if (!existing) return reply.status(404).send({ error: 'Escalation not found' });
    const escalation = await prisma.vsmEscalation.update({
      where: { id },
      data: { status: 'ACKNOWLEDGED', acknowledgedBy: request.user.sub, acknowledgedAt: new Date() },
    });
    return { escalation };
  });

  app.post('/escalations/:id/resolve', { preHandler: await requireAdminOrCeo() }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const existing = await prisma.vsmEscalation.findFirst({ where: { id, organizationId: request.user.organizationId } });
    if (!existing) return reply.status(404).send({ error: 'Escalation not found' });
    const escalation = await prisma.vsmEscalation.update({
      where: { id },
      data: { status: 'RESOLVED', resolvedBy: request.user.sub, resolvedAt: new Date() },
    });
    return { escalation };
  });
};
