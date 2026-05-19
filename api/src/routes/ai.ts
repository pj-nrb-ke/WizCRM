import type { FastifyPluginAsync } from 'fastify';
import {
  cardParseSchema,
  nextActionFeedbackSchema,
  postCallSchema,
  transcribeAudioSchema,
  voiceNoteSchema,
} from '@wizcrm/shared';
import { prisma } from '../lib/prisma.js';
import { loadLeadContext } from '../services/lead.service.js';
import {
  cleanVoiceNote,
  transcribeVoiceNote,
  generateLeadSummary,
  generateNextAction,
  generateSalesDesk,
  parseBusinessCard,
  processPostCall,
  suggestStage,
} from '../services/ai/orchestrator.js';
import { buildRulesDesk } from '../services/desk-rules.service.js';
import { isNextActionSuppressed, shouldApplySuggestedStage } from '@wizcrm/shared';

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
    let items = await generateSalesDesk(organizationId, userId, leads);
    if (items.length === 0 && leads.length > 0) {
      items = buildRulesDesk(leads);
    }
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
    const dismissed = await prisma.aiSuggestion.findFirst({
      where: { leadId, kind: 'NEXT_ACTION', status: 'DISMISSED' },
      orderBy: { createdAt: 'desc' },
    });
    if (
      isNextActionSuppressed(
        dismissed?.createdAt,
        lead.lastActivityAt,
        lead.createdAt,
      )
    ) {
      return { action: '', reason: '', dismissed: true };
    }
    const nextAction = await generateNextAction(lead, userId);
    return { ...nextAction, dismissed: false };
  });

  app.post('/leads/:leadId/next-action/dismiss', async (request, reply) => {
    const { organizationId, sub: userId } = request.user;
    const { leadId } = request.params as { leadId: string };
    const parsed = nextActionFeedbackSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.status(400).send({ error: parsed.error.flatten() });
    }
    const lead = await prisma.lead.findFirst({ where: { id: leadId, organizationId } });
    if (!lead) return reply.status(404).send({ error: 'Lead not found' });
    await prisma.aiSuggestion.create({
      data: {
        leadId,
        kind: 'NEXT_ACTION',
        payload: parsed.data,
        status: 'DISMISSED',
      },
    });
    return { ok: true };
  });

  app.post('/leads/:leadId/next-action/complete', async (request, reply) => {
    const { organizationId, sub: userId } = request.user;
    const { leadId } = request.params as { leadId: string };
    const parsed = nextActionFeedbackSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.status(400).send({ error: parsed.error.flatten() });
    }
    const lead = await prisma.lead.findFirst({ where: { id: leadId, organizationId } });
    if (!lead) return reply.status(404).send({ error: 'Lead not found' });
    await prisma.activity.create({
      data: {
        leadId,
        userId,
        type: 'NOTE',
        subject: 'Next action completed',
        body: `Completed: ${parsed.data.action}`,
      },
    });
    await prisma.lead.update({
      where: { id: leadId },
      data: { lastActivityAt: new Date() },
    });
    await prisma.aiSuggestion.create({
      data: {
        leadId,
        kind: 'NEXT_ACTION',
        payload: parsed.data,
        status: 'COMPLETED',
      },
    });
    return { ok: true };
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

  app.post('/post-call/confirm', async (request, reply) => {
    const { organizationId, sub: userId } = request.user;
    const body = request.body as {
      leadId: string;
      summary: string;
      taskTitle?: string;
      taskDueAt?: string;
      suggestedStage?: string;
      applyStage?: boolean;
    };
    if (!body.leadId || !body.summary) {
      return reply.status(400).send({ error: 'leadId and summary required' });
    }
    const lead = await prisma.lead.findFirst({
      where: { id: body.leadId, organizationId },
    });
    if (!lead) return reply.status(404).send({ error: 'Lead not found' });

    await prisma.activity.create({
      data: {
        leadId: body.leadId,
        userId,
        type: 'CALL',
        subject: 'Call logged',
        body: body.summary,
      },
    });

    if (body.taskTitle) {
      await prisma.task.create({
        data: {
          organizationId,
          userId,
          leadId: body.leadId,
          title: body.taskTitle,
          dueAt: body.taskDueAt
            ? new Date(body.taskDueAt)
            : new Date(Date.now() + 24 * 60 * 60 * 1000),
        },
      });
    }

    if (shouldApplySuggestedStage(body.applyStage, lead.stage, body.suggestedStage)) {
      await prisma.lead.update({
        where: { id: body.leadId },
        data: { stage: body.suggestedStage as never, lastActivityAt: new Date() },
      });
      await prisma.stageChange.create({
        data: {
          leadId: body.leadId,
          fromStage: lead.stage,
          toStage: body.suggestedStage as never,
          suggestedByAi: true,
          userId,
        },
      });
    } else {
      await prisma.lead.update({
        where: { id: body.leadId },
        data: { lastActivityAt: new Date() },
      });
    }

    return { ok: true };
  });

  app.post('/transcribe', async (request, reply) => {
    const { organizationId, sub: userId } = request.user;
    const parsed = transcribeAudioSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.status(400).send({ error: parsed.error.flatten() });
    }
    try {
      const result = await transcribeVoiceNote(
        organizationId,
        userId,
        parsed.data.audioBase64,
        parsed.data.mimeType,
      );
      return result;
    } catch (e) {
      const err = e as Error;
      if (err.message === 'AI_UNAVAILABLE') {
        return reply.status(503).send({
          error: 'AI_UNAVAILABLE',
          message: 'Set OPENAI_API_KEY for voice transcription',
        });
      }
      throw e;
    }
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
