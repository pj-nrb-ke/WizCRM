import type { FastifyPluginAsync } from 'fastify';
import { cardParseSchema, postCallSchema, voiceNoteSchema } from '@wizcrm/shared';
import { prisma } from '../lib/prisma.js';
import { loadLeadContext } from '../services/lead.service.js';
import {
  cleanVoiceNote,
  generateLeadSummary,
  generateNextAction,
  generateSalesDesk,
  parseBusinessCard,
  processPostCall,
  suggestStage,
} from '../services/ai/orchestrator.js';

export const aiRoutes: FastifyPluginAsync = async (app) => {
  app.addHook('onRequest', app.authenticate);

  app.get('/desk', async (request) => {
    const { organizationId, sub: userId } = request.user;
    const leads = await prisma.lead.findMany({
      where: { organizationId, ownerId: userId, stage: { notIn: ['WON', 'LOST'] } },
      include: {
        activities: { orderBy: { createdAt: 'desc' }, take: 5 },
        tasks: { where: { completedAt: null }, take: 5 },
      },
      take: 30,
    });
    const items = await generateSalesDesk(organizationId, userId, leads);
    return { items };
  });

  app.post('/card-parse', async (request, reply) => {
    const { organizationId, sub: userId } = request.user;
    const parsed = cardParseSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.status(400).send({ error: parsed.error.flatten() });
    }
    const fields = await parseBusinessCard(organizationId, userId, parsed.data);
    return { fields };
  });

  app.get('/leads/:leadId/summary', async (request, reply) => {
    const { organizationId, sub: userId } = request.user;
    const { leadId } = request.params as { leadId: string };
    const lead = await loadLeadContext(leadId, organizationId);
    if (!lead) return reply.status(404).send({ error: 'Lead not found' });
    const summary = await generateLeadSummary(lead, userId);
    return { summary };
  });

  app.get('/leads/:leadId/next-action', async (request, reply) => {
    const { organizationId, sub: userId } = request.user;
    const { leadId } = request.params as { leadId: string };
    const lead = await loadLeadContext(leadId, organizationId);
    if (!lead) return reply.status(404).send({ error: 'Lead not found' });
    const nextAction = await generateNextAction(lead, userId);
    return nextAction;
  });

  app.get('/leads/:leadId/stage-suggestion', async (request, reply) => {
    const { organizationId, sub: userId } = request.user;
    const { leadId } = request.params as { leadId: string };
    const lead = await loadLeadContext(leadId, organizationId);
    if (!lead) return reply.status(404).send({ error: 'Lead not found' });
    const suggestion = await suggestStage(lead, userId);
    return suggestion;
  });

  app.post('/post-call', async (request, reply) => {
    const { organizationId, sub: userId } = request.user;
    const parsed = postCallSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.status(400).send({ error: parsed.error.flatten() });
    }
    const lead = await loadLeadContext(parsed.data.leadId, organizationId);
    if (!lead) return reply.status(404).send({ error: 'Lead not found' });
    const result = await processPostCall(
      organizationId,
      userId,
      lead,
      parsed.data.roughNote,
    );
    return result;
  });

  app.post('/voice-note', async (request, reply) => {
    const { organizationId, sub: userId } = request.user;
    const parsed = voiceNoteSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.status(400).send({ error: parsed.error.flatten() });
    }
    const lead = await prisma.lead.findFirst({
      where: { id: parsed.data.leadId, organizationId },
    });
    if (!lead) return reply.status(404).send({ error: 'Lead not found' });
    const cleaned = await cleanVoiceNote(organizationId, userId, parsed.data.transcript);
    return cleaned;
  });
};
