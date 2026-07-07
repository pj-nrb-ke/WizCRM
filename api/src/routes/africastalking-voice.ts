import type { FastifyInstance } from 'fastify';
import { config } from '../config.js';

/** Wrap inner actions in a valid Africa's Talking Voice XML response. */
function voiceXml(inner: string): string {
  return `<?xml version="1.0" encoding="UTF-8"?>\n<Response>${inner}</Response>`;
}

// Spelled out phonetically so the TTS reads the acronyms clearly.
const MENU_PROMPT =
  'Hello! This is the Wiz A G assistant. We help Kenyan businesses run on Sage Evolution ' +
  'E R P and Wiz C R M. To book a quick demo with our team, press 1. If you are not ' +
  'interested, press 2.';

/**
 * Africa's Talking Voice IVR spike — AI BDR Phase B (DTMF menu).
 *
 * Public endpoint: AT POSTs `application/x-www-form-urlencoded` here whenever a call
 * connects, when digits are entered, and when the call ends. Stateless — returns a
 * menu, captures the pressed digit, logs it. No auth token, no DB writes.
 * See docs/AI-BDR-SPEC.md (§7) and docs/AI-BDR-BUILD-01.md.
 */
export async function africasTalkingVoiceRoutes(app: FastifyInstance): Promise<void> {
  app.post('/webhooks/africastalking/voice', async (request, reply) => {
    // Optional shared-secret guard (?k=…) — only enforced when configured.
    if (config.atVoiceCallbackSecret) {
      const provided = (request.query as { k?: string }).k;
      if (provided !== config.atVoiceCallbackSecret) {
        return reply.status(401).type('application/xml').send(voiceXml('<Reject/>'));
      }
    }

    const body = (request.body ?? {}) as Record<string, string>;
    reply.type('application/xml');

    // Terminal notification when the call ends — log cost/duration, no action.
    if (body.isActive === '0') {
      app.log.info(
        { at_voice: 'ended', session: body.sessionId, durationSec: body.durationInSeconds, cost: body.amount },
        'AT voice call ended',
      );
      return voiceXml('');
    }

    const callbackUrl =
      `${config.apiPublicUrl}/webhooks/africastalking/voice` +
      (config.atVoiceCallbackSecret ? `?k=${encodeURIComponent(config.atVoiceCallbackSecret)}` : '');

    // Returning from a GetDigits prompt — branch on what the prospect pressed.
    if (body.dtmfDigits != null && body.dtmfDigits !== '') {
      const digit = body.dtmfDigits.trim();
      app.log.info({ at_voice: 'dtmf', digit, caller: body.callerNumber }, 'AT voice DTMF captured');

      if (digit === '1') {
        return voiceXml(
          '<Say voice="woman">Great choice! Our team will reach out shortly to schedule your demo. ' +
            'Thank you, and have a great day.</Say>',
        );
      }
      if (digit === '2') {
        return voiceXml(
          '<Say voice="woman">No problem at all. We will not contact you again. Goodbye.</Say>',
        );
      }
      // Unrecognised key — re-prompt once.
      return voiceXml(
        `<GetDigits timeout="15" finishOnKey="#" numDigits="1" callbackUrl="${callbackUrl}">` +
          '<Say voice="woman">Sorry, I did not catch that. Press 1 to book a demo, or 2 if you are not interested.</Say>' +
          '</GetDigits>',
      );
    }

    // Initial connect — greet + menu.
    app.log.info(
      { at_voice: 'connect', caller: body.callerNumber, direction: body.direction },
      'AT voice call connected',
    );
    return voiceXml(
      `<GetDigits timeout="20" finishOnKey="#" numDigits="1" callbackUrl="${callbackUrl}">` +
        `<Say voice="woman">${MENU_PROMPT}</Say>` +
        '</GetDigits>',
    );
  });
}
