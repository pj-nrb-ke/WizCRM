import type { FastifyPluginAsync } from 'fastify';
import type { Prisma } from '@prisma/client';
import { createActivitySchema } from '@wizcrm/shared';
import { prisma } from '../lib/prisma.js';
import { cleanVoiceNote } from '../services/ai/orchestrator.js';
import { resolveActivityNoteBody } from '../services/note-body.service.js';

export const activityRoutes: FastifyPluginAsync = async (app) => {
  app.addHook('onRequest', app.authenticate);

  app.get('/:leadId/activities', async (request, reply) => {
    const { organizationId } = request.user;
    const { leadId } = request.params as { leadId: string };
    const lead = await prisma.lead.findFirst({ where: { id: leadId, organizationId } });
    if (!lead) return reply.status(404).send({ error: 'Lead not found' });

    const activities = await prisma.activity.findMany({
      where: { leadId },
      orderBy: { createdAt: 'desc' },
    });
    return { activities };
  });

  app.post('/:leadId/activities', async (request, reply) => {
    const { organizationId, sub: userId } = request.user;
    const { leadId } = request.params as { leadId: string };
    const parsed = createActivitySchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.status(400).send({ error: parsed.error.flatten() });
    }

    const lead = await prisma.lead.findFirst({ where: { id: leadId, organizationId } });
    if (!lead) return reply.status(404).send({ error: 'Lead not found' });

    const useAi = (request.body as { useAiClean?: boolean }).useAiClean;
    const { body, subject } = await resolveActivityNoteBody(
      {
        useAiClean: useAi,
        type: parsed.data.type,
        body: parsed.data.body,
        subject: parsed.data.subject,
      },
      (raw) => cleanVoiceNote(organizationId, userId, raw),
    );

    const activity = await prisma.activity.create({
      data: {
        leadId,
        userId,
        type: parsed.data.type,
        subject,
        body,
      },
    });

    await prisma.lead.update({
      where: { id: leadId },
      data: { lastActivityAt: new Date() },
    });

    return reply.status(201).send({ activity });
  });

  // Structured field visit report → MEETING activity (+ metadata) with an auto follow-up task.
  app.post('/:leadId/visit-report', async (request, reply) => {
    const { organizationId, sub: userId } = request.user;
    const { leadId } = request.params as { leadId: string };
    const input = (request.body ?? {}) as {
      outcome?: string;
      notes?: string;
      whoMet?: string;
      competitor?: string;
      objection?: string;
      nextStep?: string;
      nextStepDueAt?: string;
      location?: { lat: number; lng: number; label?: string };
      capturedAt?: string;
    };
    if (typeof input.outcome !== 'string' || !input.outcome.trim()) {
      return reply.status(400).send({ error: 'outcome is required' });
    }

    const lead = await prisma.lead.findFirst({ where: { id: leadId, organizationId } });
    if (!lead) return reply.status(404).send({ error: 'Lead not found' });

    const outcome = input.outcome.trim();
    const whoMet = input.whoMet?.trim();
    const competitor = input.competitor?.trim();
    const objection = input.objection?.trim();
    const nextStep = input.nextStep?.trim();
    const notes = input.notes?.trim();

    const lines = [`Outcome: ${outcome}`];
    if (whoMet) lines.push(`Met: ${whoMet}`);
    if (competitor) lines.push(`Competitor: ${competitor}`);
    if (objection) lines.push(`Objection: ${objection}`);
    if (nextStep) lines.push(`Next step: ${nextStep}`);
    if (notes) lines.push('', notes);

    const metadata = {
      kind: 'VISIT_REPORT',
      outcome,
      ...(whoMet ? { whoMet } : {}),
      ...(competitor ? { competitor } : {}),
      ...(objection ? { objection } : {}),
      ...(nextStep ? { nextStep } : {}),
      ...(input.location
        ? {
            location: {
              lat: input.location.lat,
              lng: input.location.lng,
              ...(input.location.label ? { label: input.location.label } : {}),
            },
          }
        : {}),
      ...(input.capturedAt ? { capturedAt: input.capturedAt } : {}),
    } as Prisma.InputJsonValue;

    const activity = await prisma.activity.create({
      data: {
        leadId,
        userId,
        type: 'MEETING',
        subject: 'Visit report',
        body: lines.join('\n'),
        metadata,
      },
    });

    let task: Awaited<ReturnType<typeof prisma.task.create>> | null = null;
    if (nextStep) {
      task = await prisma.task.create({
        data: {
          organizationId,
          userId,
          leadId,
          title: nextStep.slice(0, 300),
          dueAt: input.nextStepDueAt
            ? new Date(input.nextStepDueAt)
            : new Date(Date.now() + 24 * 60 * 60 * 1000),
        },
      });
    }

    await prisma.lead.update({
      where: { id: leadId },
      data: { lastActivityAt: new Date() },
    });

    return reply.status(201).send({ activity, task });
  });
};
