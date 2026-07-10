import { createHmac, timingSafeEqual } from 'node:crypto';
import { config } from '../../config.js';

/**
 * ElevenLabs Agents — the streaming platform behind conversational Jane.
 *
 * ElevenLabs carries the call audio itself (over a SIP trunk from Africa's
 * Talking, or a Twilio number), so none of the fetch-an-mp3 fragility of the
 * Voice XML path applies here. Our job is only to start calls and to catch the
 * post-call webhook.
 *
 * NOTE: written against the ElevenLabs API as documented at build time and NOT
 * yet exercised against a live account — there was no API key on this machine.
 * The verify runbook in docs/AI-VOICE-ELEVENLABS.md must be run once the key
 * exists before anything here is trusted.
 */

const API_BASE = 'https://api.elevenlabs.io';
const TIMEOUT_MS = 15000;

export class ElevenLabsNotConfiguredError extends Error {
  readonly code = 'ELEVENLABS_NOT_CONFIGURED';
}

function requireConfig(): { apiKey: string; agentId: string; phoneNumberId: string } {
  const { elevenLabsApiKey, elevenLabsAgentId, elevenLabsPhoneNumberId } = config;
  if (!elevenLabsApiKey || !elevenLabsAgentId || !elevenLabsPhoneNumberId) {
    throw new ElevenLabsNotConfiguredError(
      'Set ELEVENLABS_API_KEY, ELEVENLABS_AGENT_ID and ELEVENLABS_PHONE_NUMBER_ID',
    );
  }
  return {
    apiKey: elevenLabsApiKey,
    agentId: elevenLabsAgentId,
    phoneNumberId: elevenLabsPhoneNumberId,
  };
}

async function elCall<T>(path: string, init: RequestInit & { apiKey: string }): Promise<T> {
  const { apiKey, ...rest } = init;
  const res = await fetch(`${API_BASE}${path}`, {
    ...rest,
    headers: {
      'xi-api-key': apiKey,
      'Content-Type': 'application/json',
      ...(rest.headers ?? {}),
    },
    signal: AbortSignal.timeout(TIMEOUT_MS),
  });
  const text = await res.text();
  if (!res.ok) {
    throw new Error(`ElevenLabs ${path} -> HTTP ${res.status}: ${text.slice(0, 300)}`);
  }
  return (text ? JSON.parse(text) : {}) as T;
}

export type OutboundCallResult = {
  conversationId: string | null;
  callSid: string | null;
  raw: unknown;
};

/**
 * Start an outbound agent call to an E.164 number.
 *
 * ElevenLabs exposes separate endpoints per telephony provider. We try the SIP
 * endpoint first (the AT-trunk architecture) and fall back to the Twilio one,
 * so the same code works during a Twilio-based pilot.
 */
export async function startOutboundCall(toNumber: string): Promise<OutboundCallResult> {
  const { apiKey, agentId, phoneNumberId } = requireConfig();
  const body = JSON.stringify({
    agent_id: agentId,
    agent_phone_number_id: phoneNumberId,
    to_number: toNumber,
  });

  const endpoints = ['/v1/convai/sip-trunk/outbound-call', '/v1/convai/twilio/outbound-call'];
  let lastError: unknown;
  for (const path of endpoints) {
    try {
      const out = await elCall<Record<string, unknown>>(path, { method: 'POST', body, apiKey });
      return {
        conversationId: (out.conversation_id as string) ?? null,
        callSid: (out.callSid as string) ?? (out.call_sid as string) ?? null,
        raw: out,
      };
    } catch (e) {
      lastError = e;
      // A 404/405 here usually means "wrong provider for this phone number id" —
      // try the other endpoint before giving up.
    }
  }
  throw lastError instanceof Error ? lastError : new Error('ElevenLabs outbound call failed');
}

/** Pull the full conversation (transcript, analysis) after a call. */
export async function getConversation(conversationId: string): Promise<Record<string, unknown>> {
  const { apiKey } = requireConfig();
  return elCall(`/v1/convai/conversations/${encodeURIComponent(conversationId)}`, {
    method: 'GET',
    apiKey,
  });
}

/**
 * Verify the `ElevenLabs-Signature` header on a post-call webhook.
 * Format: `t=<unix seconds>,v0=<hex hmac-sha256(secret, "<t>.<raw body>")>`.
 *
 * Returns false rather than throwing: a webhook endpoint that crashes on a
 * malformed header is a webhook endpoint an attacker can crash.
 */
export function verifyWebhookSignature(
  rawBody: string,
  signatureHeader: string | undefined,
  secret: string,
  nowSeconds = Math.floor(Date.now() / 1000),
): boolean {
  if (!secret || !signatureHeader) return false;

  const parts = new Map(
    signatureHeader.split(',').map((p) => {
      const i = p.indexOf('=');
      return [p.slice(0, i).trim(), p.slice(i + 1).trim()] as const;
    }),
  );
  const t = parts.get('t');
  const v0 = parts.get('v0');
  if (!t || !v0 || !/^\d+$/.test(t)) return false;

  // Reject stale signatures: a captured webhook must not be replayable forever.
  if (Math.abs(nowSeconds - Number(t)) > 30 * 60) return false;

  const expected = createHmac('sha256', secret).update(`${t}.${rawBody}`).digest('hex');
  const a = Buffer.from(expected, 'hex');
  const b = Buffer.from(v0.replace(/^v0=/, ''), 'hex');
  return a.length === b.length && timingSafeEqual(a, b);
}

/** Shape of the parts of the post-call payload we actually use. */
export type PostCallPayload = {
  type?: string;
  data?: {
    conversation_id?: string;
    agent_id?: string;
    status?: string;
    transcript?: Array<{ role?: string; message?: string }>;
    metadata?: {
      call_duration_secs?: number;
      phone_call?: { external_number?: string; direction?: string };
    };
    analysis?: {
      call_successful?: string;
      transcript_summary?: string;
      data_collection_results?: Record<string, { value?: unknown }>;
    };
  };
};

/** Flatten the transcript into readable "Jane: … / Caller: …" lines. */
export function renderTranscript(payload: PostCallPayload): string {
  const turns = payload.data?.transcript ?? [];
  return turns
    .filter((t) => t.message)
    .map((t) => `${t.role === 'agent' ? 'Jane' : 'Caller'}: ${t.message}`)
    .join('\n')
    .slice(0, 4500);
}
