import type { FastifyPluginAsync } from 'fastify';
import { createLeadSchema, updateLeadSchema } from '@wizcrm/shared';
import { prisma } from '../lib/prisma.js';
import {
  createLead,
  updateLead,
  findDuplicateLeads,
  loadLeadContext,
} from '../services/lead.service.js';

export const leadRoutes: FastifyPluginAsync = async (app) => {
  app.addHook('onRequest', app.authenticate);

  app.get('/', async (request) => {
    const { organizationId, sub: userId } = request.user;
    const stage = (request.query as { stage?: string }).stage;
    const leads = await prisma.lead.findMany({
      where: {
        organizationId,
        ...(stage ? { stage: stage as never } : {}),
      },
      orderBy: { updatedAt: 'desc' },
      take: 200,
    });
    return { leads };
  });

  app.get('/pipeline', async (request) => {
    const { organizationId } = request.user;
    const leads = await prisma.lead.findMany({
      where: { organizationId, stage: { notIn: ['WON', 'LOST'] } },
      orderBy: { updatedAt: 'desc' },
    });
    const pipeline = leads.reduce<Record<string, typeof leads>>((acc, lead) => {
      if (!acc[lead.stage]) acc[lead.stage] = [];
      acc[lead.stage].push(lead);
      return acc;
    }, {});
    return { pipeline };
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
