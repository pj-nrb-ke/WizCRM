import { createReadStream } from 'node:fs';
import type { FastifyPluginAsync } from 'fastify';
import { createLeadAttachmentSchema, createLeadMessageSchema, createLeadVisitSchema } from '@wizcrm/shared';
import {
  createLeadAttachment,
  createLeadMessage,
  getLeadAttachmentFile,
  listLeadAttachments,
  listLeadMessages,
} from '../services/lead-thread.service.js';
import { createLeadVisit, listLeadVisits } from '../services/lead-visit.service.js';

export const leadThreadRoutes: FastifyPluginAsync = async (app) => {
  app.addHook('onRequest', app.authenticate);

  app.get('/:leadId/messages', async (request, reply) => {
    const { organizationId } = request.user;
    const { leadId } = request.params as { leadId: string };
    const { opportunityId } = request.query as { opportunityId?: string };
    const messages = await listLeadMessages(organizationId, leadId, 100, opportunityId);
    if (!messages) return reply.status(404).send({ error: 'Lead not found' });
    return { messages };
  });

  app.post('/:leadId/messages', async (request, reply) => {
    const { organizationId, sub: userId } = request.user;
    const { leadId } = request.params as { leadId: string };
    const parsed = createLeadMessageSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.status(400).send({ error: parsed.error.flatten() });
    }
    const message = await createLeadMessage(
      organizationId,
      leadId,
      userId,
      parsed.data.body,
      parsed.data.opportunityId,
    );
    if (!message) return reply.status(404).send({ error: 'Lead not found' });
    if ('error' in message) return reply.status(400).send({ error: message.error });
    return reply.status(201).send({ message });
  });

  app.get('/:leadId/attachments', async (request, reply) => {
    const { organizationId } = request.user;
    const { leadId } = request.params as { leadId: string };
    const { opportunityId } = request.query as { opportunityId?: string };
    const attachments = await listLeadAttachments(organizationId, leadId, opportunityId);
    if (!attachments) return reply.status(404).send({ error: 'Lead not found' });
    return { attachments };
  });

  app.post('/:leadId/attachments', async (request, reply) => {
    const { organizationId, sub: userId } = request.user;
    const { leadId } = request.params as { leadId: string };
    const parsed = createLeadAttachmentSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.status(400).send({ error: parsed.error.flatten() });
    }
    const result = await createLeadAttachment(organizationId, leadId, userId, parsed.data);
    if (!result) return reply.status(404).send({ error: 'Lead not found' });
    if ('error' in result) {
      const code = result.error;
      const status = code === 'FILE_TOO_LARGE' ? 413 : 400;
      return reply.status(status).send({ error: code });
    }
    return reply.status(201).send({ attachment: result.attachment });
  });

  app.get('/:leadId/visits', async (request, reply) => {
    const { organizationId } = request.user;
    const { leadId } = request.params as { leadId: string };
    const visits = await listLeadVisits(organizationId, leadId);
    if (!visits) return reply.status(404).send({ error: 'Lead not found' });
    return { visits };
  });

  app.post('/:leadId/visits', async (request, reply) => {
    const { organizationId, sub: userId } = request.user;
    const { leadId } = request.params as { leadId: string };
    const parsed = createLeadVisitSchema.safeParse(request.body ?? {});
    if (!parsed.success) {
      return reply.status(400).send({ error: parsed.error.flatten() });
    }
    const visit = await createLeadVisit(organizationId, leadId, userId, parsed.data);
    if (!visit) return reply.status(404).send({ error: 'Lead not found' });
    return reply.status(201).send({ visit });
  });

  app.get('/:leadId/attachments/:attachmentId', async (request, reply) => {
    const { organizationId } = request.user;
    const { leadId, attachmentId } = request.params as { leadId: string; attachmentId: string };
    const row = await getLeadAttachmentFile(organizationId, leadId, attachmentId);
    if (!row) return reply.status(404).send({ error: 'Not found' });
    // Force download (never render inline) and stop MIME-sniffing so an uploaded
    // HTML/SVG attachment can't execute as stored XSS when fetched same-origin.
    reply.header('Content-Type', row.mimeType);
    reply.header('X-Content-Type-Options', 'nosniff');
    reply.header(
      'Content-Disposition',
      `attachment; filename="${row.fileName.replace(/["\r\n]/g, '')}"`,
    );
    return reply.send(createReadStream(row.storagePath));
  });
};
