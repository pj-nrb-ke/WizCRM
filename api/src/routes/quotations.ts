import type { FastifyPluginAsync } from 'fastify';
import { createQuotationSchema, updateQuotationSchema } from '@wizcrm/shared';
import {
  createQuotation,
  listQuotationsForLead,
  updateQuotation,
} from '../services/quotation.service.js';

function isManager(role: string) {
  return role === 'MANAGER' || role === 'ADMIN';
}

export const quotationRoutes: FastifyPluginAsync = async (app) => {
  app.addHook('onRequest', app.authenticate);

  app.get('/lead/:leadId', async (request, reply) => {
    const { organizationId } = request.user;
    const { leadId } = request.params as { leadId: string };
    const rows = await listQuotationsForLead(leadId, organizationId);
    if (!rows) return reply.status(404).send({ error: 'Lead not found' });
    return { quotations: rows };
  });

  app.post('/', async (request, reply) => {
    const { organizationId, sub: userId, role } = request.user;
    if (!isManager(role)) {
      return reply.status(403).send({ error: 'Managers only' });
    }
    const parsed = createQuotationSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.status(400).send({ error: parsed.error.flatten() });
    }
    const q = await createQuotation(organizationId, userId, parsed.data);
    if (!q) return reply.status(404).send({ error: 'Lead not found' });
    return reply.status(201).send({ quotation: q });
  });

  app.patch('/:id', async (request, reply) => {
    const { organizationId, role } = request.user;
    if (!isManager(role)) {
      return reply.status(403).send({ error: 'Managers only' });
    }
    const { id } = request.params as { id: string };
    const parsed = updateQuotationSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.status(400).send({ error: parsed.error.flatten() });
    }
    const q = await updateQuotation(id, organizationId, parsed.data);
    if (!q) return reply.status(404).send({ error: 'Quotation not found' });
    return { quotation: q };
  });
};
