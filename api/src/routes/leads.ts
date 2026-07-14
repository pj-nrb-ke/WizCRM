import type { FastifyPluginAsync, FastifyReply, FastifyRequest } from 'fastify';
import {
  createLeadSchema,
  mergePipelineStages,
  normalizePipelineStagesForSave,
  pipelineStagesPatchSchema,
  pipelineStageIds,
  pipelineReorderSchema,
  updateLeadSchema,
  bulkImportLeadsSchema,
  bulkUpdateLeadsSchema,
  isLeadStage,
  photoCaptureCreateSchema,
} from '@wizcrm/shared';
import { prisma } from '../lib/prisma.js';
import { getOrgSettings, mergeOrgSettings } from '../services/org-settings.service.js';
import {
  createLeadGuarded,
  updateLead,
  bulkUpdateLeads,
  reorderPipelineLeads,
  findDuplicateLeads,
  loadLeadContext,
  DuplicateLeadError,
} from '../services/lead.service.js';
import { getCrmConfig } from '../services/crm-config.service.js';
import { bulkImportLeads } from '../services/lead-import.service.js';
import { buildLeadInsights } from '../services/lead-insights.service.js';
import { getOrganizationEntitlements } from '../services/entitlements.service.js';
import { resolveStaleLeadDays } from '../services/stale-lead.service.js';
import { getTeamMemberIds } from '../services/team.service.js';
import { createCalendarEvent } from '../services/calendar.service.js';
import { createLeadAttachment } from '../services/lead-thread.service.js';

const ownerSelect = {
  id: true,
  name: true,
  email: true,
  team: { select: { id: true, name: true } },
} as const;

function isManager(role: string) {
  return role === 'MANAGER' || role === 'ADMIN';
}

function isManagerRole(role: string) {
  return isManager(role);
}

function requireManager() {
  return async (request: FastifyRequest, reply: FastifyReply) => {
    if (!isManager(request.user.role)) {
      return reply.status(403).send({ error: 'Managers and admins only' });
    }
  };
}

export const leadRoutes: FastifyPluginAsync = async (app) => {
  app.addHook('onRequest', app.authenticate);

  app.get('/pipeline/config', { preHandler: requireManager() }, async (request) => {
    const settings = await getOrgSettings(request.user.organizationId);
    const stages = mergePipelineStages(settings.pipelineStages);
    return { stages };
  });

  app.patch('/pipeline/config', { preHandler: requireManager() }, async (request, reply) => {
    const parsed = pipelineStagesPatchSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.status(400).send({ error: parsed.error.flatten() });
    }
    const openCount = parsed.data.stages.filter(
      (s) => s.inPipeline && s.stage !== 'WON' && s.stage !== 'LOST',
    ).length;
    if (openCount < 1) {
      return reply.status(400).send({ error: 'At least one open pipeline stage is required' });
    }
    const settings = await mergeOrgSettings(request.user.organizationId, {
      pipelineStages: normalizePipelineStagesForSave(parsed.data.stages),
    });
    return { stages: mergePipelineStages(settings.pipelineStages) };
  });

  app.patch('/pipeline/reorder', { preHandler: requireManager() }, async (request, reply) => {
    const parsed = pipelineReorderSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.status(400).send({ error: parsed.error.flatten() });
    }
    try {
      await reorderPipelineLeads(
        request.user.organizationId,
        parsed.data.stage,
        parsed.data.leadIds,
      );
      return { ok: true };
    } catch (e) {
      const err = e as Error & { statusCode?: number };
      return reply.status(err.statusCode ?? 500).send({ error: err.message });
    }
  });

  app.get('/', async (request, reply) => {
    const { organizationId, sub, role } = request.user;
    const q = request.query as { stage?: string; teamId?: string; ownerId?: string; tag?: string };
    let ownerFilter: { ownerId?: string | { in: string[] } } = {};
    if (!isManager(role)) {
      // Non-managers only ever see their own leads, regardless of query params.
      ownerFilter = { ownerId: sub };
    } else if (q.ownerId) {
      ownerFilter = { ownerId: q.ownerId };
    } else if (q.teamId) {
      const memberIds = await getTeamMemberIds(q.teamId, organizationId);
      if (!memberIds) {
        return reply.status(404).send({ error: 'Team not found' });
      }
      if (memberIds.length === 0) {
        return { leads: [] };
      }
      ownerFilter = { ownerId: { in: memberIds } };
    }
    const tag = q.tag?.trim();
    // Only apply the stage filter if it's a real enum value — a garbage value
    // passed straight to Prisma's enum column throws (500); ignore it instead.
    const stageFilter = q.stage && isLeadStage(q.stage) ? { stage: q.stage as never } : {};
    const leads = await prisma.lead.findMany({
      where: {
        organizationId,
        ...stageFilter,
        ...(tag ? { tags: { has: tag } } : {}),
        ...ownerFilter,
      },
      include: { owner: { select: ownerSelect } },
      orderBy: { updatedAt: 'desc' },
      take: 200,
    });
    return { leads };
  });

  app.get('/pipeline', async (request, reply) => {
    const { organizationId, sub, role } = request.user;
    const q = request.query as { teamId?: string; ownerId?: string };
    const stages = mergePipelineStages((await getOrgSettings(organizationId)).pipelineStages);
    const stageIds = pipelineStageIds(stages);
    let ownerFilter: { ownerId?: string | { in: string[] } } = {};
    if (!isManager(role)) {
      // Non-managers only ever see their own pipeline, regardless of query params.
      ownerFilter = { ownerId: sub };
    } else if (q.ownerId) {
      ownerFilter = { ownerId: q.ownerId };
    } else if (q.teamId) {
      const memberIds = await getTeamMemberIds(q.teamId, organizationId);
      if (!memberIds) {
        return reply.status(404).send({ error: 'Team not found' });
      }
      if (memberIds.length === 0) {
        return { stages, pipeline: {} };
      }
      ownerFilter = { ownerId: { in: memberIds } };
    }
    const leads = await prisma.lead.findMany({
      where: { organizationId, stage: { in: stageIds }, ...ownerFilter },
      include: { owner: { select: ownerSelect } },
      orderBy: [{ pipelineRank: 'asc' }, { updatedAt: 'desc' }],
    });
    const pipeline = leads.reduce<Record<string, typeof leads>>((acc, lead) => {
      if (!acc[lead.stage]) acc[lead.stage] = [];
      acc[lead.stage].push(lead);
      return acc;
    }, {});
    return { stages, pipeline };
  });

  /** Read-only CRM lists (sources, loss reasons) for all authenticated users (mobile + web). */
  app.get('/crm-config', async (request) => {
    const { organizationId } = request.user;
    return getCrmConfig(organizationId);
  });

  app.post('/bulk-update', { preHandler: requireManager() }, async (request, reply) => {
    const { organizationId, sub: userId, role } = request.user;
    const parsed = bulkUpdateLeadsSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.status(400).send({ error: parsed.error.flatten() });
    }
    try {
      const result = await bulkUpdateLeads(organizationId, userId, role, parsed.data);
      return result;
    } catch (e) {
      const err = e as Error & { statusCode?: number };
      return reply.status(err.statusCode ?? 500).send({ error: err.message });
    }
  });

  app.post('/import', async (request, reply) => {
    const { organizationId, sub: userId, role } = request.user;
    if (!isManagerRole(role)) {
      return reply.status(403).send({ error: 'Managers only' });
    }
    const parsed = bulkImportLeadsSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.status(400).send({ error: parsed.error.flatten() });
    }
    const result = await bulkImportLeads(
      organizationId,
      userId,
      parsed.data.rows,
      parsed.data.ownerId,
    );
    return reply.status(201).send(result);
  });

  app.get('/check-duplicates', async (request, reply) => {
    const { organizationId } = request.user;
    const q = request.query as { email?: string; phone?: string; excludeId?: string };
    if (!q.email && !q.phone) {
      return reply.status(400).send({ error: 'email or phone required' });
    }
    const duplicates = await findDuplicateLeads(
      organizationId,
      q.email,
      q.phone,
      q.excludeId,
    );
    return { duplicates, hasDuplicates: duplicates.length > 0 };
  });

  app.get('/:id/tasks', async (request, reply) => {
    const { organizationId } = request.user;
    const { id } = request.params as { id: string };
    const lead = await prisma.lead.findFirst({ where: { id, organizationId } });
    if (!lead) return reply.status(404).send({ error: 'Lead not found' });
    const tasks = await prisma.task.findMany({
      where: { leadId: id, organizationId },
      orderBy: { dueAt: 'asc' },
    });
    return { tasks };
  });

  app.get('/:id/insights', async (request, reply) => {
    const { organizationId } = request.user;
    const ent = await getOrganizationEntitlements(organizationId);
    if (!ent.features.leadInsights) {
      return reply.status(403).send({ error: 'Pro plan required for lead insights' });
    }
    const { id } = request.params as { id: string };
    const lead = await prisma.lead.findFirst({
      where: { id, organizationId },
      include: {
        tasks: { where: { completedAt: null }, take: 15 },
      },
    });
    if (!lead) return reply.status(404).send({ error: 'Lead not found' });
    const staleDays = await resolveStaleLeadDays(organizationId);
    return { insights: buildLeadInsights(lead, staleDays) };
  });

  app.get('/:id', async (request, reply) => {
    const { organizationId } = request.user;
    const { id } = request.params as { id: string };
    const lead = await loadLeadContext(id, organizationId);
    if (!lead) return reply.status(404).send({ error: 'Lead not found' });
    return { lead };
  });

  app.post('/', async (request, reply) => {
    const { organizationId, sub: userId } = request.user;
    const parsed = createLeadSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.status(400).send({ error: parsed.error.flatten() });
    }
    const force = (request.body as { force?: boolean }).force;
    try {
      const lead = await createLeadGuarded(organizationId, userId, parsed.data, Boolean(force));
      return reply.status(201).send({ lead });
    } catch (e) {
      if (e instanceof DuplicateLeadError) {
        return reply.status(409).send({ error: 'DUPLICATE', duplicates: e.duplicates });
      }
      throw e;
    }
  });

  // Manager-only: creates a lead already assigned to someone else, from a photo
  // capture (exhibition/tender/billboard). Mirrors /leads/import's "ownerId
  // set by the caller, not the caller's own id" precedent.
  app.post('/photo-capture', { preHandler: requireManager() }, async (request, reply) => {
    const { organizationId, sub: userId } = request.user;
    const parsed = photoCaptureCreateSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.status(400).send({ error: parsed.error.flatten() });
    }
    const { ownerId, pitchNote, event, photo, ...leadInput } = parsed.data;

    const owner = await prisma.user.findFirst({
      where: { id: ownerId, organizationId },
      select: { id: true, role: true },
    });
    if (!owner || !['SALES', 'MANAGER'].includes(owner.role)) {
      return reply.status(400).send({ error: 'Invalid owner' });
    }

    const force = (request.body as { force?: boolean }).force;
    let lead;
    try {
      lead = await createLeadGuarded(organizationId, ownerId, leadInput, Boolean(force));
    } catch (e) {
      if (e instanceof DuplicateLeadError) {
        return reply.status(409).send({ error: 'DUPLICATE', duplicates: e.duplicates });
      }
      throw e;
    }

    await prisma.activity.create({
      data: { leadId: lead.id, userId, type: 'NOTE', subject: 'AI pitch note (photo capture)', body: pitchNote },
    });

    let attachmentError: string | undefined;
    if (photo) {
      try {
        const result = await createLeadAttachment(organizationId, lead.id, userId, {
          fileName: photo.fileName,
          mimeType: photo.mimeType,
          dataBase64: photo.dataBase64,
        });
        if (result && 'error' in result) attachmentError = result.error;
      } catch (e) {
        attachmentError = e instanceof Error ? e.message : 'Could not save original photo';
      }
    }

    let calendarEvent = null;
    let calendarError: string | undefined;
    if (event) {
      try {
        calendarEvent = await createCalendarEvent(organizationId, userId, {
          title: event.title,
          startAt: event.startAt,
          endAt: event.endAt,
          leadId: lead.id,
          attendeeIds: event.attendeeIds,
        });
      } catch (e) {
        calendarError = e instanceof Error ? e.message : 'Could not create calendar event';
      }
    }

    return reply.status(201).send({ lead, calendarEvent, calendarError, attachmentError });
  });

  app.patch('/:id', async (request, reply) => {
    const { organizationId, sub: userId } = request.user;
    const { id } = request.params as { id: string };
    const parsed = updateLeadSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.status(400).send({ error: parsed.error.flatten() });
    }
    try {
      const lead = await updateLead(id, organizationId, userId, parsed.data, request.user.role);
      if (!lead) return reply.status(404).send({ error: 'Lead not found' });
      return { lead };
    } catch (e) {
      const err = e as Error & { statusCode?: number };
      return reply.status(err.statusCode ?? 500).send({ error: err.message });
    }
  });
};
