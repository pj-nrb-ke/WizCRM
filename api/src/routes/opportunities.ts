import type { FastifyPluginAsync } from 'fastify';
import {
  createOpportunityExpenseSchema,
  createSalesOpportunitySchema,
  updateOpportunityExpenseSchema,
  updateSalesOpportunitySchema,
} from '@wizcrm/shared';
import {
  createSalesOpportunity,
  listOpportunitiesForLead,
  updateSalesOpportunity,
} from '../services/opportunity.service.js';
import {
  createOpportunityExpense,
  deleteOpportunityExpense,
  getOpportunityCostSummary,
  listOpportunityExpenses,
  updateOpportunityExpense,
} from '../services/opportunity-expense.service.js';
import { getLeadCostRollup } from '../services/opportunity-rollup.service.js';
import { prisma } from '../lib/prisma.js';

function isManagerRole(role: string) {
  return role === 'MANAGER' || role === 'ADMIN';
}

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

  app.get('/lead/:leadId/cost-rollup', async (request, reply) => {
    const { organizationId, role } = request.user;
    if (!isManagerRole(role)) {
      return reply.status(403).send({ error: 'Managers only' });
    }
    const { leadId } = request.params as { leadId: string };
    const lead = await prisma.lead.findFirst({ where: { id: leadId, organizationId } });
    if (!lead) return reply.status(404).send({ error: 'Lead not found' });
    return getLeadCostRollup(leadId, organizationId);
  });

  app.post('/', async (request, reply) => {
    const { organizationId, sub: userId, role } = request.user;
    const parsed = createSalesOpportunitySchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.status(400).send({ error: parsed.error.flatten() });
    }
    const input = isManagerRole(role) ? parsed.data : { ...parsed.data, budgeted: undefined };
    const opp = await createSalesOpportunity(organizationId, userId, input);
    if (!opp) return reply.status(404).send({ error: 'Lead not found' });
    return reply.status(201).send({ opportunity: opp });
  });

  app.patch('/:id', async (request, reply) => {
    const { organizationId, sub: userId, role } = request.user;
    const { id } = request.params as { id: string };
    const parsed = updateSalesOpportunitySchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.status(400).send({ error: parsed.error.flatten() });
    }
    if (parsed.data.budgeted !== undefined && !isManagerRole(role)) {
      return reply.status(403).send({ error: 'Only managers can set the budget' });
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

  app.get('/:id/summary', async (request, reply) => {
    const { organizationId, sub: userId, role } = request.user;
    const { id } = request.params as { id: string };
    const opp = await prisma.salesOpportunity.findFirst({ where: { id, organizationId } });
    if (!opp) return reply.status(404).send({ error: 'Opportunity not found' });
    if (opp.ownerId !== userId && !isManagerRole(role)) {
      return reply.status(403).send({ error: 'Not your opportunity' });
    }
    const summary = await getOpportunityCostSummary(id, organizationId);
    return { summary };
  });

  app.get('/:id/expenses', async (request, reply) => {
    const { organizationId, sub: userId, role } = request.user;
    const { id } = request.params as { id: string };
    const opp = await prisma.salesOpportunity.findFirst({ where: { id, organizationId } });
    if (!opp) return reply.status(404).send({ error: 'Opportunity not found' });
    if (opp.ownerId !== userId && !isManagerRole(role)) {
      return reply.status(403).send({ error: 'Not your opportunity' });
    }
    const expenses = await listOpportunityExpenses(id, organizationId);
    return { expenses };
  });

  app.post('/:id/expenses', async (request, reply) => {
    const { organizationId, sub: userId } = request.user;
    const { id } = request.params as { id: string };
    const parsed = createOpportunityExpenseSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.status(400).send({ error: parsed.error.flatten() });
    }
    const result = await createOpportunityExpense(id, organizationId, userId, parsed.data);
    if (!result) return reply.status(404).send({ error: 'Opportunity not found' });
    if ('error' in result) {
      return reply.status(403).send({ error: 'Only the opportunity owner can log expenses' });
    }
    return reply.status(201).send({ expense: result.expense });
  });

  app.patch('/expenses/:expenseId', async (request, reply) => {
    const { organizationId, sub: userId, role } = request.user;
    const { expenseId } = request.params as { expenseId: string };
    const parsed = updateOpportunityExpenseSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.status(400).send({ error: parsed.error.flatten() });
    }
    const result = await updateOpportunityExpense(expenseId, organizationId, userId, role, parsed.data);
    if (!result) return reply.status(404).send({ error: 'Expense not found' });
    if ('error' in result) return reply.status(403).send({ error: 'Not allowed' });
    return { expense: result.expense };
  });

  app.delete('/expenses/:expenseId', async (request, reply) => {
    const { organizationId, sub: userId, role } = request.user;
    const { expenseId } = request.params as { expenseId: string };
    const result = await deleteOpportunityExpense(expenseId, organizationId, userId, role);
    if (!result) return reply.status(404).send({ error: 'Expense not found' });
    if ('error' in result) return reply.status(403).send({ error: 'Not allowed' });
    return { ok: true };
  });
};
