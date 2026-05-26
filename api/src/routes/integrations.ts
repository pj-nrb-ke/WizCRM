import type { FastifyPluginAsync } from 'fastify';
import { webhookLeadSchema } from '@wizcrm/shared';
import { ingestWebhookLead, resolveOrgByWebhookSecret } from '../services/webhook.service.js';

export const integrationRoutes: FastifyPluginAsync = async (app) => {
  app.post('/webhook/leads', async (request, reply) => {
    const secret =
      (request.headers['x-wizcrm-webhook-key'] as string | undefined)?.trim() ||
      (request.query as { key?: string }).key?.trim();
    if (!secret) {
      return reply.status(401).send({ error: 'Missing X-WizCRM-Webhook-Key header or key query' });
    }

    const organizationId = await resolveOrgByWebhookSecret(secret);
    if (!organizationId) {
      return reply.status(401).send({ error: 'Invalid webhook key' });
    }

    const parsed = webhookLeadSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.status(400).send({ error: parsed.error.flatten() });
    }

    try {
      const lead = await ingestWebhookLead(organizationId, parsed.data);
      return reply.status(201).send({ lead: { id: lead.id, name: lead.name } });
    } catch (e) {
      const err = e as Error & { statusCode?: number };
      return reply.status(err.statusCode ?? 500).send({ error: err.message });
    }
  });
};
