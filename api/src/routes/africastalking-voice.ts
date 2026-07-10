import type { FastifyInstance } from 'fastify';
import { config } from '../config.js';
import {
  escapeXml,
  escapeXmlAttr,
  nextReply,
  transcribeRecordingUrl,
  type Turn,
} from '../services/ai/voice-agent.service.js';

/** Wrap inner actions in a valid Africa's Talking Voice XML response. */
function voiceXml(inner: string): string {
  return `<?xml version="1.0" encoding="UTF-8"?>\n<Response>${inner}</Response>`;
}

// Kenya's Data Protection Act requires telling people they are being recorded,
// and saying who is calling. Both belong in the first breath, not the small print.
const GREETING =
  'Hello! This is Jane calling from Wiz A G. I am an automated assistant, and this call is ' +
  'recorded so we can serve you better.';

const OPENER =
  'We help Kenyan businesses run on Sage Evolution E R P and Wiz C R M, so your team can track ' +
  'leads and quotations without the paperwork. Does your business use a C R M today?';

/** Long enough for a considered answer, short enough that nobody rambles into a timeout. */
const RECORD_ATTRS = 'finishOnKey="#" maxLength="15" trimSilence="true" playBeep="true"';

/** A caller who has said this much has either bought in or bailed out. */
const MAX_TURNS = 6;

/** Two unusable recordings in a row means the line is bad. Stop wasting their time. */
const MAX_FAILURES = 2;

const SESSION_TTL_MS = 30 * 60_000;

type Session = { turns: Turn[]; failures: number; lastSeen: number };

/**
 * In-memory, single-instance, lost on restart — and that is fine. A call lasts a
 * minute; a deploy drops at most one in flight. Persisting it would buy nothing
 * and cost a write on every syllable.
 */
const sessions = new Map<string, Session>();

function pruneSessions(now: number): void {
  for (const [id, s] of sessions) {
    if (now - s.lastSeen > SESSION_TTL_MS) sessions.delete(id);
  }
}

function getSession(sessionId: string): Session {
  const now = Date.now();
  pruneSessions(now);
  const existing = sessions.get(sessionId);
  if (existing) {
    existing.lastSeen = now;
    return existing;
  }
  const fresh: Session = { turns: [], failures: 0, lastSeen: now };
  sessions.set(sessionId, fresh);
  return fresh;
}

function say(text: string): string {
  return `<Say voice="woman">${escapeXml(text)}</Say>`;
}

/** Speak, then listen. AT posts the recording back to us and the loop continues. */
function sayThenRecord(text: string, callbackUrl: string): string {
  return `<Record ${RECORD_ATTRS} callbackUrl="${escapeXmlAttr(callbackUrl)}">${say(text)}</Record>`;
}

/**
 * Africa's Talking Voice — conversational AI BDR (Phase C).
 *
 * AT POSTs `application/x-www-form-urlencoded` here when a call connects, each
 * time a recording finishes, and when the call ends. We transcribe what the
 * caller said, ask the model what Jane says next, and answer with speech.
 *
 * AT holds the phone line open while this handler runs, so nothing here may
 * hang: every outbound step is time-boxed and every failure path still speaks.
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

    const sessionId = body.sessionId ?? 'unknown';

    // Terminal notification — log cost/duration and let the session go.
    if (body.isActive === '0') {
      const s = sessions.get(sessionId);
      app.log.info(
        {
          at_voice: 'ended',
          session: sessionId,
          durationSec: body.durationInSeconds,
          cost: body.amount,
          turns: s ? s.turns.length : 0,
        },
        'AT voice call ended',
      );
      sessions.delete(sessionId);
      return voiceXml('');
    }

    const callbackUrl =
      `${config.apiPublicUrl}/webhooks/africastalking/voice` +
      (config.atVoiceCallbackSecret ? `?k=${encodeURIComponent(config.atVoiceCallbackSecret)}` : '');

    const session = getSession(sessionId);

    // ── The caller has spoken: transcribe, think, reply ──────────────────────
    if (body.recordingUrl) {
      const started = Date.now();
      const heard = await transcribeRecordingUrl(body.recordingUrl);
      const transcribeMs = Date.now() - started;

      if (!heard) {
        session.failures += 1;
        app.log.warn(
          { at_voice: 'no_speech', session: sessionId, failures: session.failures, transcribeMs },
          'AT voice recording had no usable speech',
        );
        if (session.failures >= MAX_FAILURES) {
          sessions.delete(sessionId);
          return voiceXml(
            say(
              'I am still having trouble hearing you. A colleague from Wiz A G will call you back. Goodbye.',
            ),
          );
        }
        return voiceXml(
          sayThenRecord('Sorry, I did not catch that. Could you say it once more?', callbackUrl),
        );
      }

      session.failures = 0;
      session.turns.push({ role: 'user', content: heard });

      const thinkStarted = Date.now();
      const { reply: janeSays, endCall } = await nextReply(session.turns);
      session.turns.push({ role: 'assistant', content: janeSays });

      app.log.info(
        {
          at_voice: 'turn',
          session: sessionId,
          caller: body.callerNumber,
          heard,
          janeSays,
          endCall,
          transcribeMs,
          thinkMs: Date.now() - thinkStarted,
          turn: Math.ceil(session.turns.length / 2),
        },
        'AT voice turn',
      );

      // Wrap up if the model says we are done, or the caller has given us enough.
      if (endCall || session.turns.length >= MAX_TURNS * 2) {
        sessions.delete(sessionId);
        return voiceXml(say(janeSays));
      }
      return voiceXml(sayThenRecord(janeSays, callbackUrl));
    }

    // ── Initial connect: introduce Jane, disclose recording, then listen ─────
    app.log.info(
      { at_voice: 'connect', session: sessionId, caller: body.callerNumber, direction: body.direction },
      'AT voice call connected',
    );
    session.turns.push({ role: 'assistant', content: `${GREETING} ${OPENER}` });
    return voiceXml(say(GREETING) + sayThenRecord(OPENER, callbackUrl));
  });
}
