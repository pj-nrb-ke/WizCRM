import type { FastifyPluginAsync, FastifyReply, FastifyRequest } from 'fastify';
import {
  createLeadSchema,
  mergePipelineStages,
  normalizePipelineStagesForSave,
  pipelineStagesPatchSchema,
  pipelineStageIds,
  pipelineReorderSchema,
  updateLeadSchema,
} from '@wizcrm/shared';
import { prisma } from '../lib/prisma.js';
import { getOrgSettings, mergeOrgSettings } from '../services/org-settings.service.js';
import {
  createLead,
  updateLead,
  reorderPipelineLeads,
  findDuplicateLeads,
  loadLeadContext,
} from '../services/lead.service.js';
import { buildLeadInsights } from '../services/lead-insights.service.js';
import { getTeamMemberIds } from '../services/team.service.js';

const ownerSelect = {
  id: true,
  name: true,
  email: true,
  team: { select: { id: true, name: true } },
} as const;

function isManager(role: string) {
  return role === 'MANAGER' || role === 'ADMIN';
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
    const { organizationId } = request.user;
    const q = request.query as { stage?: string; teamId?: string; ownerId?: string };
    let ownerFilter: { ownerId?: string | { in: string[] } } = {};
    if (q.ownerId) {
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
    const leads = await prisma.lead.findMany({
      where: {
        organizationId,
        ...(q.stage ? { stage: q.stage as never } : {}),
        ...ownerFilter,
      },
      include: { owner: { select: ownerSelect } },
      orderBy: { updatedAt: 'desc' },
      take: 200,
    });
    return { leads };
  });

  app.get('/pipeline', async (request, reply) => {
    const { organizationId } = request.user;
    const q = request.query as { teamId?: string; ownerId?: string };
    const stages = mergePipelineStages((await getOrgSettings(organizationId)).pipelineStages);
    const stageIds = pipelineStageIds(stages);
    let ownerFilter: { ownerId?: string | { in: string[] } } = {};
    if (q.ownerId) {
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
    const { id } = request.params as { id: string };
    const lead = await prisma.lead.findFirst({
      where: { id, organizationId },
      include: {
        tasks: { where: { completedAt: null }, take: 15 },
      },
    });
    if (!lead) return reply.status(404).send({ error: 'Lead not found' });
    return { insights: buildLeadInsights(lead) };
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
    const duplicates = await findDuplicateLeads(
      organizationId,
      parsed.data.email,
      parsed.data.phone,
    );
    const force = (request.body as { force?: boolean }).force;
    if (duplicates.length > 0 && !force) {
      return reply.status(409).send({
        error: 'DUPLICATE',
        duplicates,
      });
    }
    const lead = await createLead(organizationId, userId, parsed.data);
    return reply.status(201).send({ lead });
  });

  app.patch('/:id', async (request, reply) => {
    const { organizationId, sub: userId } = request.user;
    const { id } = request.params as { id: string };
    const parsed = updateLeadSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.status(400).send({ error: parsed.error.flatten() });
    }
    try {
      const lead = await updateLead(id, organizationId, userId, parsed.data);
      if (!lead) return reply.status(404).send({ error: 'Lead not found' });
      return { lead };
    } catch (e) {
      const err = e as Error & { statusCode?: number };
      return reply.status(err.statusCode ?? 500).send({ error: err.message });
    }
  });
};
