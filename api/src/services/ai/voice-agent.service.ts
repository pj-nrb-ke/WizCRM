import { chatJson, createOpenAIClient, transcribeAudio } from './openai.provider.js';

/**
 * "Jane", the WizAG voice agent — AI BDR Phase C.
 *
 * A turn is: the caller speaks, Africa's Talking hands us a recording URL, we
 * transcribe it, decide what Jane says next, and hand back speech. The whole
 * round trip happens inside one HTTP request that AT is waiting on, so every
 * step is time-boxed and every failure has something safe to say.
 */

export type Turn = { role: 'assistant' | 'user'; content: string };

/** AT waits on our response. Past this, it gives up and the caller hears silence. */
const RECORDING_FETCH_TIMEOUT_MS = 8000;

const SYSTEM_PROMPT = `You are Jane, a warm and direct sales representative for WizAG, a Kenyan company in Nairobi.

WizAG sells:
- WizCRM — a CRM built for Kenyan SMEs: tracks leads, quotations, field visits and sales pipelines. Reps capture visit notes by voice and the CRM writes the report itself.
- Sage Evolution ERP and accounting, with local implementation and support.

You are on a live phone call with a business person in Kenya. Rules:
- Speak like a person on a phone, not a brochure. One or two short sentences, then ONE question. Never monologue.
- Your words are read aloud by a text-to-speech engine. No emoji, no bullet points, no markdown, no abbreviations it would mangle. Write "ERP" as "E R P" and "CRM" as "C R M".
- Never invent prices, discounts, customer names, or features. If asked something you do not know, say a colleague will confirm.
- If they sound interested, offer to book a short demo and ask what day suits them.
- If they say no, are busy, or ask to be removed: apologise once, promise no further calls, and end.
- If the transcript is unclear or empty, ask them politely to repeat, once.
- Never claim to be a human if asked directly. Say you are an automated assistant from WizAG.

Set "endCall" to true only when the conversation is genuinely finished: they declined, they agreed to a demo, or they asked you to stop. Otherwise keep it false.

Reply as JSON: {"reply": "what Jane says next", "endCall": false}`;

export type AgentReply = { reply: string; endCall: boolean };

/** What Jane says when the model or the network lets us down mid-call. */
export const FALLBACK_REPLY: AgentReply = {
  reply:
    'I am sorry, I did not catch that. A colleague from Wiz A G will call you back shortly. Thank you for your time.',
  endCall: true,
};

/**
 * Download the caller's recording and transcribe it.
 * Returns an empty string when the audio is unusable — the caller said nothing,
 * or the fetch failed. An empty string is a valid outcome, not an error.
 */
export async function transcribeRecordingUrl(url: string): Promise<string> {
  const client = createOpenAIClient();
  if (!client) return '';

  let res: Response;
  try {
    res = await fetch(url, { signal: AbortSignal.timeout(RECORDING_FETCH_TIMEOUT_MS) });
  } catch {
    return '';
  }
  if (!res.ok) return '';

  const buf = Buffer.from(await res.arrayBuffer());
  // A near-empty file means the caller stayed silent; skip the Whisper call.
  if (buf.byteLength < 1024) return '';

  try {
    return await transcribeAudio(client, buf.toString('base64'), extensionFor(url));
  } catch {
    return '';
  }
}

/** Whisper picks the decoder from the file extension, so get it from the URL. */
export function extensionFor(url: string): string {
  const path = url.split('?')[0];
  const dot = path.lastIndexOf('.');
  if (dot === -1) return 'wav';
  const ext = path.slice(dot + 1).toLowerCase();
  return /^[a-z0-9]{2,4}$/.test(ext) ? ext : 'wav';
}

export async function nextReply(history: Turn[]): Promise<AgentReply> {
  const client = createOpenAIClient();
  if (!client) return FALLBACK_REPLY;

  const transcript = history
    .map((t) => `${t.role === 'assistant' ? 'Jane' : 'Caller'}: ${t.content}`)
    .join('\n');

  try {
    const out = await chatJson<{ reply?: unknown; endCall?: unknown }>(
      client,
      SYSTEM_PROMPT,
      `Conversation so far:\n\n${transcript}\n\nWhat does Jane say next?`,
    );
    const reply = typeof out.reply === 'string' ? out.reply.trim() : '';
    if (!reply) return FALLBACK_REPLY;
    return { reply: reply.slice(0, 600), endCall: out.endCall === true };
  } catch {
    return FALLBACK_REPLY;
  }
}

/**
 * Escape text before it goes inside <Say>. The model's words land straight in
 * XML; an unescaped ampersand in "Johnson & Sons" would break the whole response
 * and the caller would hear nothing at all.
 */
export function escapeXml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}
