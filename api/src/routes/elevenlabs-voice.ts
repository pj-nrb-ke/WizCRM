import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import { z } from 'zod';
import { normalizePhone } from '@wizcrm/shared';
import { config } from '../config.js';
import { prisma } from '../lib/prisma.js';
import {
  ElevenLabsNotConfiguredError,
  renderTranscript,
  startOutboundCall,
  verifyWebhookSignature,
  type PostCallPayload,
} from '../services/ai/elevenlabs.service.js';

const startCallSchema = z.object({
  /** E.164, e.g. +2547… */
  to: z.string().regex(/^\+\d{9,15}$/, 'Use E.164, e.g. +2547…'),
  leadId: z.string().uuid().optional(),
});

function requireManager() {
  return async (request: FastifyRequest, reply: FastifyReply) => {
    if (request.user.role !== 'MANAGER' && request.user.role !== 'ADMIN') {
      return reply.status(403).send({ error: 'Managers and admins only' });
    }
  };
}

/**
 * Conversational Jane on ElevenLabs Agents.
 *
 * Two halves: an authenticated trigger that starts an outbound call, and the
 * public post-call webhook that writes the transcript and outcome onto the
 * lead's timeline — the part Africa's Talking's broken recordings never let
 * the XML version have.
 */
export async function elevenLabsVoiceRoutes(app: FastifyInstance): Promise<void> {
  // The webhook signature covers the raw bytes, so this plugin keeps bodies as
  // strings and parses JSON only after verification. Fastify encapsulation
  // scopes the parser to the routes in this file.
  app.addContentTypeParser('application/json', { parseAs: 'string' }, (_req, body, done) => {
    done(null, body);
  });

  app.post(
    '/voice-agent/call',
    { onRequest: [app.authenticate], preHandler: requireManager() },
    async (request, reply) => {
      const parsed = startCallSchema.safeParse(
        typeof request.body === 'string' ? JSON.parse(request.body || '{}') : request.body,
      );
      if (!parsed.success) {
        return reply.status(400).send({ error: parsed.error.flatten() });
      }
      const { to, leadId } = parsed.data;
      const { organizationId, sub: userId } = request.user;

      if (leadId) {
        const lead = await prisma.lead.findFirst({ where: { id: leadId, organizationId } });
        if (!lead) return reply.status(404).send({ error: 'Lead not found' });
      }

      try {
        const result = await startOutboundCall(to);
        app.log.info(
          { el_voice: 'call_started', to, conversationId: result.conversationId, leadId },
          'ElevenLabs outbound call started',
        );
        if (leadId) {
          await prisma.activity.create({
            data: {
              leadId,
              userId,
              type: 'CALL',
              subject: 'AI call placed (Jane)',
              body: `Jane is calling ${to}. The transcript will appear here when the call ends.`,
              metadata: { elevenLabsConversationId: result.conversationId },
            },
          });
        }
        return { ok: true, conversationId: result.conversationId };
      } catch (e) {
        if (e instanceof ElevenLabsNotConfiguredError) {
          return reply.status(503).send({ error: e.message, code: e.code });
        }
        app.log.error({ err: e }, 'ElevenLabs outbound call failed');
        return reply.status(502).send({ error: 'Could not start the call. See server logs.' });
      }
    },
  );

  /**
   * Post-call webhook. Public by necessity; authenticated by HMAC signature.
   * Configure in the ElevenLabs dashboard: Agents → Settings → Post-call webhook.
   */
  app.post('/webhooks/elevenlabs/post-call', async (request, reply) => {
    const rawBody = typeof request.body === 'string' ? request.body : JSON.stringify(request.body ?? {});

    if (!config.elevenLabsWebhookSecret) {
      // Refuse rather than trust-by-default: an unverifiable webhook that writes
      // to lead timelines is an open door, and silent trust is how today's other
      // bugs happened.
      app.log.warn({ el_voice: 'webhook_rejected' }, 'ELEVENLABS_WEBHOOK_SECRET is not set');
      return reply.status(503).send({ error: 'Webhook secret not configured' });
    }

    const signature = request.headers['elevenlabs-signature'] as string | undefined;
    if (!verifyWebhookSignature(rawBody, signature, config.elevenLabsWebhookSecret)) {
      app.log.warn({ el_voice: 'webhook_bad_signature' }, 'ElevenLabs webhook signature failed');
      return reply.status(401).send({ error: 'Bad signature' });
    }

    let payload: PostCallPayload;
    try {
      payload = JSON.parse(rawBody) as PostCallPayload;
    } catch {
      return reply.status(400).send({ error: 'Invalid JSON' });
    }

    const data = payload.data ?? {};
    const phone = data.metadata?.phone_call?.external_number ?? '';
    const durationSec = data.metadata?.call_duration_secs;
    const summary = data.analysis?.transcript_summary ?? '';
    const outcome = data.analysis?.call_successful ?? 'unknown';
    const transcript = renderTranscript(payload);

    app.log.info(
      {
        el_voice: 'post_call',
        conversationId: data.conversation_id,
        phone,
        durationSec,
        outcome,
      },
      'ElevenLabs post-call webhook received',
    );

    // Attach to the lead whose phone matches. Single-tenant in practice; if no
    // lead matches, the log line above is still the system of record.
    const normalized = phone ? normalizePhone(phone) : '';
    const lead = normalized
      ? await prisma.lead.findFirst({ where: { phoneNormalized: normalized } })
      : null;

    if (lead) {
      // Attribute the note to an admin of the lead's org — activities need an author.
      const author = await prisma.user.findFirst({
        where: { organizationId: lead.organizationId, role: 'ADMIN' },
        select: { id: true },
      });
      if (author) {
        const lines = [
          `Outcome: ${outcome}${durationSec != null ? ` · ${durationSec}s` : ''}`,
          summary ? `\nSummary: ${summary}` : '',
          transcript ? `\n--- Transcript ---\n${transcript}` : '',
        ];
        await prisma.activity.create({
          data: {
            leadId: lead.id,
            userId: author.id,
            type: 'CALL',
            subject: 'AI call completed (Jane)',
            body: lines.join('\n').slice(0, 5000),
            metadata: { elevenLabsConversationId: data.conversation_id ?? null },
          },
        });
        await prisma.lead.update({
          where: { id: lead.id },
          data: { lastActivityAt: new Date() },
        });
      }
    }

    return { ok: true };
  });
}
