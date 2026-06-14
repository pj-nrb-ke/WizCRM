import type { FastifyPluginAsync } from 'fastify';
import { createSalesOpportunitySchema, updateSalesOpportunitySchema } from '@wizcrm/shared';
import {
  createSalesOpportunity,
  listOpportunitiesForLead,
  updateSalesOpportunity,
} from '../services/opportunity.service.js';
import { prisma } from '../lib/prisma.js';

export const opportunityRoutes: FastifyPluginAsync = async (app) => {
  app.addHook('onRequest', app.authenticate);

  app.get('/lead/:leadId', async (request, reply) => {
    const { organizationId } = request.user;
    const { leadId } = request.params as { leadId: string };
    const lead = await prisma.lead.findFirst({ where: { id: leadId, organizationId } });
    if (!lead) return reply.status(404).send({ error: 'Lead not found' });
    const opportunities = await listOpportunitiesForLead(leadId, organizationId);
    return { opportunities };
  });

  app.post('/', async (request, reply) => {
    const { organizationId, sub: userId } = request.user;
    const parsed = createSalesOpportunitySchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.status(400).send({ error: parsed.error.flatten() });
    }
    const opp = await createSalesOpportunity(organizationId, userId, parsed.data);
    if (!opp) return reply.status(404).send({ error: 'Lead not found' });
    return reply.status(201).send({ opportunity: opp });
  });

  app.patch('/:id', async (request, reply) => {
    const { organizationId, sub: userId } = request.user;
    const { id } = request.params as { id: string };
    const parsed = updateSalesOpportunitySchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.status(400).send({ error: parsed.error.flatten() });
    }
    try {
      const opp = await updateSalesOpportunity(id, organizationId, userId, parsed.data);
      if (!opp) return reply.status(404).send({ error: 'Opportunity not found' });
      return { opportunity: opp };
    } catch (e) {
      const err = e as Error & { statusCode?: number };
      return reply.status(err.statusCode ?? 500).send({ error: err.message });
    }
  });
};
