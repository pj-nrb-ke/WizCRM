import type { FastifyInstance } from 'fastify';
import { config } from '../config.js';
import {
  escapeXml,
  escapeXmlAttr,
  nextReply,
  renderSpeech,
  transcribeRecordingUrl,
  type Turn,
} from '../services/ai/voice-agent.service.js';
import { getAudio } from '../services/ai/voice-audio.store.js';

/** Wrap inner actions in a valid Africa's Talking Voice XML response. */
function voiceXml(inner: string): string {
  return `<?xml version="1.0" encoding="UTF-8"?>\n<Response>${inner}</Response>`;
}

// Kenya's Data Protection Act requires telling people they are being recorded,
// and saying who is calling. Both belong in the first breath, not the small print.
const GREETING =
  "Hi there, this is Jane from Wiz A G. Just so you know, I'm an automated assistant and this " +
  "call is recorded. I'll keep it short.";

const OPENER =
  "We help Kenyan businesses run on Sage Evolution E R P and Wiz C R M, so your team isn't " +
  'chasing leads and quotations on paper. Tell me, are you using a C R M at the moment?';

/**
 * No beep — a person does not chirp at you before listening.
 * `timeout` is the silence AT waits through before deciding you have finished;
 * the default left a long dead pause after every sentence. Three seconds is
 * about the length of a natural thinking pause, and no longer.
 */
const RECORD_ATTRS =
  'finishOnKey="#" maxLength="10" timeout="3" trimSilence="true" playBeep="false"';

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

/**
 * Speak a line. Prefers our own synthesised voice, played back by URL; falls
 * back to AT's built-in <Say> if synthesis is unavailable. A robotic Jane beats
 * a silent one.
 */
function sayTag(text: string): string {
  return `<Say voice="woman">${escapeXml(text)}</Say>`;
}

/**
 * Speak a line, either through our synthesised voice or AT's own.
 *
 * `isGreeting` exists for VOICE_TTS=probe: the greeting is the one line we can
 * afford to lose while testing whether <Play> works on this account, because
 * everything after it still speaks through <Say> and the call survives.
 */
async function say(text: string, isGreeting = false): Promise<string> {
  const mode = config.voiceTts;
  const usePlay = mode === 'play' || (mode === 'probe' && isGreeting);
  if (!usePlay) return sayTag(text);

  const id = await renderSpeech(text);
  if (!id) return sayTag(text);
  return `<Play url="${escapeXmlAttr(`${config.apiPublicUrl}/voice/audio/${id}.mp3`)}"/>`;
}

/**
 * Speak, then listen.
 *
 * The prompt MUST be nested inside <Record>. A <Record> with children is a
 * *partial* recording: it plays the prompt, captures the answer, and POSTs a
 * recordingUrl to callbackUrl. A childless <Record> is a *terminal* recording —
 * it records the rest of the call and posts nothing, so the conversation dies
 * with the caller talking into the void.
 *
 * Nesting was never the reason <Play> failed; the audio format was. AT aborted
 * on the first unplayable file and so never fetched the nested one.
 */
async function sayThenRecord(text: string, callbackUrl: string): Promise<string> {
  const speech = await say(text);
  return `<Record ${RECORD_ATTRS} callbackUrl="${escapeXmlAttr(callbackUrl)}">${speech}</Record>`;
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

    // AT's recordingUrl points at at-internal.com and 404s. Log the whole
    // payload so we can see every field they actually send, rather than the
    // handful the docs mention.
    if (config.voiceDebug) {
      app.log.info({ at_voice: 'raw_callback', body }, 'AT voice raw callback body');
    }

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
      let result = await transcribeRecordingUrl(body.recordingUrl);

      // AT hands us the URL the moment it stops recording; the file itself can
      // take a beat to land. One short retry costs less than losing the turn.
      if (result.reason === 'http_error' || result.reason === 'too_small') {
        await new Promise((r) => setTimeout(r, 700));
        result = await transcribeRecordingUrl(body.recordingUrl);
      }
      const heard = result.text;
      const transcribeMs = Date.now() - started;

      if (!heard) {
        session.failures += 1;
        app.log.warn(
          {
            at_voice: 'no_speech',
            session: sessionId,
            failures: session.failures,
            transcribeMs,
            reason: result.reason,
            status: result.status,
            bytes: result.bytes,
            contentType: result.contentType,
            detail: result.detail,
            recordingUrl: body.recordingUrl,
          },
          'AT voice recording had no usable speech',
        );
        if (session.failures >= MAX_FAILURES) {
          sessions.delete(sessionId);
          return voiceXml(
            await say(
              "Sorry, I'm still not hearing you clearly. A colleague from Wiz A G will call you back. Goodbye.",
            ),
          );
        }
        return voiceXml(
          await sayThenRecord("Sorry, I didn't catch that. Could you say it once more?", callbackUrl),
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
        return voiceXml(await say(janeSays));
      }
      return voiceXml(await sayThenRecord(janeSays, callbackUrl));
    }

    // ── Initial connect: introduce Jane, disclose recording, then listen ─────
    app.log.info(
      { at_voice: 'connect', session: sessionId, caller: body.callerNumber, direction: body.direction },
      'AT voice call connected',
    );
    session.turns.push({ role: 'assistant', content: `${GREETING} ${OPENER}` });
    const [greeting, opener] = await Promise.all([
      say(GREETING, true),
      sayThenRecord(OPENER, callbackUrl),
    ]);
    return voiceXml(greeting + opener);
  });

  /**
   * Serves a line of Jane's synthesised speech to Africa's Talking.
   *
   * Public and unauthenticated because AT fetches it from its own servers with
   * no credentials. The id is a hash of the text, so it reveals nothing and
   * guessing one yields, at worst, a sentence about C R M software.
   */
  app.get('/voice/audio/:id.mp3', async (request, reply) => {
    const { id } = request.params as { id: string };
    const audio = getAudio(id.replace(/\.mp3$/, ''));
    if (!audio) return reply.status(404).send({ error: 'Not found' });
    // No Accept-Ranges: we do not honour Range requests, and advertising support
    // we do not have invites a player to ask for a 206 and get a 200 instead.
    return reply
      .type('audio/mpeg')
      .header('Content-Length', String(audio.byteLength))
      .header('Cache-Control', 'public, max-age=600')
      .send(audio);
  });
}
