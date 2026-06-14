import type { FastifyPluginAsync } from 'fastify';
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
};
