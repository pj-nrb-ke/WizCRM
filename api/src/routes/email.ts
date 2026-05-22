import type { FastifyPluginAsync } from 'fastify';
import { sendLeadEmailSchema } from '@wizcrm/shared';
import { prisma } from '../lib/prisma.js';
import { getBrevoStatus } from '../services/brevo-config.js';
import { EmailUnavailableError, sendTransactionalEmail } from '../services/brevo-mail.js';

export const emailRoutes: FastifyPluginAsync = async (app) => {
  app.addHook('onRequest', app.authenticate);

  app.get('/status', async () => getBrevoStatus());

  app.post('/leads/:leadId/send', async (request, reply) => {
    const { organizationId, sub: userId } = request.user;
    const { leadId } = request.params as { leadId: string };
    const parsed = sendLeadEmailSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.status(400).send({ error: parsed.error.flatten() });
    }

    const lead = await prisma.lead.findFirst({
      where: { id: leadId, organizationId },
    });
    if (!lead) return reply.status(404).send({ error: 'Lead not found' });
    if (!lead.email) {
      return reply.status(400).send({ error: 'Lead has no email address' });
    }

    try {
      const result = await sendTransactionalEmail({
        toEmail: lead.email,
        toName: lead.name,
        subject: parsed.data.subject,
        text: parsed.data.body,
        html: parsed.data.html,
      });

      await prisma.activity.create({
        data: {
          leadId,
          userId,
          type: 'EMAIL',
          subject: parsed.data.subject,
          body: `Email sent to ${lead.email} via Brevo (${result.method}).\n\n${parsed.data.body}`,
        },
      });

      await prisma.lead.update({
        where: { id: leadId },
        data: { lastActivityAt: new Date() },
      });

      return { ok: true, method: result.method, to: lead.email };
    } catch (e) {
      if (e instanceof EmailUnavailableError) {
        return reply.status(503).send({
          error: 'EMAIL_UNAVAILABLE',
          message: e.message,
        });
      }
      const err = e as Error;
      return reply.status(502).send({
        error: 'EMAIL_SEND_FAILED',
        message: err.message,
      });
    }
  });
};
