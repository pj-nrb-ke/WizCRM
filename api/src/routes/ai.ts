import type { FastifyPluginAsync } from 'fastify';
import {
  cardParseSchema,
  nextActionFeedbackSchema,
  nextActionTaskSchema,
  photoCaptureAnalyzeSchema,
  postCallSchema,
  suggestLeadCaptureSchema,
  transcribeAudioSchema,
  visitCaptureSchema,
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
  isPastEvent,
  parseBusinessCard,
  parsePhotoCapture,
  processPostCall,
  processVisitCapture,
  researchCompanyForPitch,
  suggestStage,
  suggestLeadCapture,
} from '../services/ai/orchestrator.js';
import { findDuplicateCapture } from '../services/photo-capture-duplicate.service.js';
import { buildQuotationDeskItems } from '../services/quote-desk.service.js';
import { config } from '../config.js';
import { buildExtendedDesk, mergeDueTasksIntoDesk } from '../services/desk-rules.service.js';
import { resolveDeskUseAi } from '../services/org-settings.service.js';
import { resolveStaleLeadDays } from '../services/stale-lead.service.js';
import { getOrganizationEntitlements } from '../services/entitlements.service.js';
import { isNextActionSuppressed, shouldApplySuggestedStage } from '@wizcrm/shared';

export const aiRoutes: FastifyPluginAsync = async (app) => {
  app.addHook('onRequest', app.authenticate);

  app.get('/desk', async (request) => {
    const { organizationId, sub: userId } = request.user;
    const leadInclude = {
      activities: { orderBy: { createdAt: 'desc' as const }, take: 5 },
      tasks: { where: { completedAt: null }, take: 5 },
    };
    const baseLeads = await prisma.lead.findMany({
      where: { organizationId, ownerId: userId, stage: { notIn: ['WON', 'LOST'] } },
      include: leadInclude,
      orderBy: { updatedAt: 'desc' },
      take: 30,
    });
    const overdueLeadIds = (
      await prisma.task.findMany({
        where: {
          completedAt: null,
          dueAt: { lte: new Date() },
          lead: { organizationId, ownerId: userId, stage: { notIn: ['WON', 'LOST'] } },
        },
        select: { leadId: true },
        distinct: ['leadId'],
        take: 15,
      })
    )
      .map((t) => t.leadId)
      .filter((id): id is string => Boolean(id));
    const missingIds = overdueLeadIds.filter((id) => !baseLeads.some((l) => l.id === id));
    const overdueLeads =
      missingIds.length > 0
        ? await prisma.lead.findMany({
            where: { id: { in: missingIds } },
            include: leadInclude,
          })
        : [];
    const leads = [...overdueLeads, ...baseLeads] as typeof baseLeads;
    const staleLeadDays = await resolveStaleLeadDays(organizationId);
    let rulesItems = buildExtendedDesk(leads, staleLeadDays);
    const quoteItems = await buildQuotationDeskItems(organizationId, userId);
    if (quoteItems.length > 0) {
      rulesItems = [...quoteItems, ...rulesItems].slice(0, 8);
    }
    const deskUseAi = await resolveDeskUseAi(organizationId);
    if (!deskUseAi || !config.aiEnabled) {
      return { items: rulesItems, source: 'rules' as const };
    }
    try {
      let items = await generateSalesDesk(organizationId, userId, leads);
      if (items.length === 0 && leads.length > 0) {
        items = rulesItems;
      } else {
        items = mergeDueTasksIntoDesk(items, rulesItems);
      }
      return { items, source: 'ai' as const };
    } catch {
      return { items: rulesItems, source: 'rules' as const };
    }
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

  // Open to any signed-in user — any team member can capture a lead from a
  // photo now, not just managers.
  app.post('/photo-capture', async (request, reply) => {
    const { organizationId, sub: userId } = request.user;
    const parsed = photoCaptureAnalyzeSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.status(400).send({ error: parsed.error.flatten() });
    }
    const fields = await parsePhotoCapture(organizationId, userId, {
      imageBase64: parsed.data.imageBase64,
      imageMimeType: parsed.data.imageMimeType,
      category: parsed.data.category,
    });
    let pitchNote = fields.pitchNote;
    if (parsed.data.category === 'BILLBOARD_SIGNBOARD' && fields.company) {
      const research = await researchCompanyForPitch(
        organizationId,
        userId,
        fields.company,
        fields.whatFor ?? '',
      );
      if (research) pitchNote = `${pitchNote}\n\nWhat they may need: ${research}`;
    }
    const [duplicate, pastEvent] = await Promise.all([
      findDuplicateCapture(organizationId, parsed.data.category, fields),
      Promise.resolve(isPastEvent(fields)),
    ]);
    return { fields: { ...fields, pitchNote }, duplicate, pastEvent };
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

  app.post('/leads/:leadId/next-action/create-task', async (request, reply) => {
    const { organizationId, sub: userId } = request.user;
    const ent = await getOrganizationEntitlements(organizationId);
    if (!ent.features.leadInsights) {
      return reply.status(403).send({ error: 'Pro plan required' });
    }
    const { leadId } = request.params as { leadId: string };
    const parsed = nextActionTaskSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.status(400).send({ error: parsed.error.flatten() });
    }
    const lead = await prisma.lead.findFirst({ where: { id: leadId, organizationId } });
    if (!lead) return reply.status(404).send({ error: 'Lead not found' });
    const dueAt = parsed.data.dueAt
      ? new Date(parsed.data.dueAt)
      : (() => {
          const d = new Date();
          d.setDate(d.getDate() + 1);
          d.setHours(17, 0, 0, 0);
          return d;
        })();
    const task = await prisma.task.create({
      data: {
        organizationId,
        userId,
        leadId,
        title: parsed.data.action.slice(0, 300),
        dueAt,
      },
    });
    await prisma.aiSuggestion.create({
      data: {
        leadId,
        kind: 'NEXT_ACTION',
        payload: parsed.data,
        status: 'COMPLETED',
      },
    });
    return { task };
  });

  app.post('/leads/suggest-capture', async (request, reply) => {
    const { organizationId, sub: userId } = request.user;
    const ent = await getOrganizationEntitlements(organizationId);
    if (!ent.features.leadInsights) {
      return reply.status(403).send({ error: 'Pro plan required for smart capture' });
    }
    const parsed = suggestLeadCaptureSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.status(400).send({ error: parsed.error.flatten() });
    }
    return suggestLeadCapture(organizationId, userId, parsed.data);
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

  // AI Visit Capture — rep's raw voice transcript -> structured Visit Report
  // draft (outcome/who/competitor/objection/next-step + stage suggestion).
  // Drafts only; the rep reviews and saves via POST /leads/:id/visit-report.
  app.post('/leads/:leadId/visit-capture', async (request, reply) => {
    const { organizationId, sub: userId } = request.user;
    const { leadId } = request.params as { leadId: string };
    const parsed = visitCaptureSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.status(400).send({ error: parsed.error.flatten() });
    }
    const lead = await loadLeadContext(leadId, organizationId);
    if (!lead) return reply.status(404).send({ error: 'Lead not found' });
    try {
      const draft = await processVisitCapture(
        organizationId,
        userId,
        lead,
        parsed.data.transcript,
        new Date().toISOString(),
      );
      return { draft };
    } catch (e) {
      const err = e as Error;
      if (err.message === 'AI_UNAVAILABLE') {
        return reply.status(503).send({
          error: 'AI_UNAVAILABLE',
          message: 'Set OPENAI_API_KEY for AI visit capture',
        });
      }
      throw e;
    }
  });

  app.get('/leads/:leadId/draft-message', async (request, reply) => {
    const { organizationId } = request.user;
    const ent = await getOrganizationEntitlements(organizationId);
    if (!ent.features.communicationDrafts) {
      return reply.status(403).send({ error: 'Pro plan required for communication drafts' });
    }
    const { leadId } = request.params as { leadId: string };
    const q = request.query as { channel?: string; tone?: string };
    const lead = await loadLeadContext(leadId, organizationId);
    if (!lead) return reply.status(404).send({ error: 'Lead not found' });
    const channel = q.channel === 'email' ? 'email' : 'whatsapp';
    const tone = q.tone === 'formal' ? 'formal' : 'friendly';
    const greeting = tone === 'formal' ? 'Dear' : 'Hi';
    const name = lead.name.split(' ')[0];
    const company = lead.company ? ` at ${lead.company}` : '';
    const body =
      channel === 'email'
        ? `${greeting} ${name},\n\nThank you for your time. Following up on our conversation${company} — please let me know if you have any questions.\n\nBest regards`
        : `${greeting} ${name}, thanks for chatting today. Happy to share more details${company} — when is a good time to connect?`;
    return {
      channel,
      tone,
      draft: body,
      note: config.aiEnabled
        ? 'Template draft — approve before sending (Pro).'
        : 'Template draft (AI off).',
    };
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
