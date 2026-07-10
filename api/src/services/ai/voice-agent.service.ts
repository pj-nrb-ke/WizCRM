import { spawn } from 'node:child_process';
import { chatJson, createOpenAIClient, transcribeAudio } from './openai.provider.js';
import { audioIdFor, hasAudio, putAudio } from './voice-audio.store.js';

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

/** Warm and unhurried. AT's own <Say> engine is the robot we are replacing. */
export const TTS_VOICE = 'nova';

/** tts-1, not tts-1-hd: on a phone line the extra fidelity is inaudible and costs a second. */
const TTS_MODEL = 'tts-1';
const TTS_TIMEOUT_MS = 8000;

/** OpenAI returns raw PCM at this rate; the phone network speaks 8 kHz. */
const OPENAI_PCM_RATE = 24000;
export const TELEPHONY_RATE = 8000;
const DECIMATION = OPENAI_PCM_RATE / TELEPHONY_RATE; // 3

/**
 * Drop 24 kHz mono PCM to 8 kHz by averaging each group of three samples.
 *
 * The averaging is a crude low-pass filter. Plain decimation would alias the
 * 4–12 kHz band down into the speech range and make Jane sound gritty; three-tap
 * averaging costs nothing and removes most of it. Speech at 8 kHz is what every
 * telephone in the world already sounds like, so nothing is lost.
 */
export function downsampleTo8k(pcm: Buffer): Buffer {
  const inSamples = Math.floor(pcm.length / 2);
  const outSamples = Math.floor(inSamples / DECIMATION);
  const out = Buffer.alloc(outSamples * 2);
  for (let i = 0; i < outSamples; i++) {
    const base = i * DECIMATION;
    const sum =
      pcm.readInt16LE(base * 2) +
      pcm.readInt16LE((base + 1) * 2) +
      pcm.readInt16LE((base + 2) * 2);
    out.writeInt16LE(Math.round(sum / DECIMATION), i * 2);
  }
  return out;
}

/**
 * Encode 24 kHz mono PCM as an 8 kHz mono MP3 — the format Africa's Talking
 * uses for its own call recordings, and the only one we have reason to believe
 * its player accepts. It fetched both a 24 kHz mp3 and an 8 kHz WAV happily and
 * played silence for each.
 *
 * Resolves null when ffmpeg is missing or misbehaves, which makes the caller
 * fall back to <Say>. Never let the voice kill the call.
 */
export function encodeTelephonyMp3(pcm24k: Buffer): Promise<Buffer | null> {
  return new Promise((resolve) => {
    const ff = spawn('ffmpeg', [
      '-hide_banner', '-loglevel', 'error',
      '-f', 's16le', '-ar', String(OPENAI_PCM_RATE), '-ac', '1', '-i', 'pipe:0',
      '-ar', String(TELEPHONY_RATE), '-ac', '1',
      // Constant bitrate: some telephony decoders will not seek a VBR header.
      '-b:a', '32k', '-write_xing', '0',
      '-f', 'mp3', 'pipe:1',
    ]);

    const chunks: Buffer[] = [];
    let settled = false;
    const done = (value: Buffer | null) => {
      if (settled) return;
      settled = true;
      resolve(value);
    };

    const timer = setTimeout(() => {
      ff.kill('SIGKILL');
      done(null);
    }, TTS_TIMEOUT_MS);

    ff.stdout.on('data', (c: Buffer) => chunks.push(c));
    ff.on('error', () => {
      clearTimeout(timer);
      done(null);
    });
    ff.on('close', (code) => {
      clearTimeout(timer);
      const out = Buffer.concat(chunks);
      done(code === 0 && out.byteLength > 256 ? out : null);
    });

    ff.stdin.on('error', () => undefined); // ffmpeg died early; 'close' handles it
    ff.stdin.end(pcm24k);
  });
}

/** Wrap 16-bit mono PCM in a canonical 44-byte WAV header. */
export function pcmToWav(pcm: Buffer, sampleRate = TELEPHONY_RATE): Buffer {
  const header = Buffer.alloc(44);
  const byteRate = sampleRate * 2; // mono, 16-bit
  header.write('RIFF', 0);
  header.writeUInt32LE(36 + pcm.length, 4);
  header.write('WAVE', 8);
  header.write('fmt ', 12);
  header.writeUInt32LE(16, 16); // PCM chunk size
  header.writeUInt16LE(1, 20); // format: PCM
  header.writeUInt16LE(1, 22); // channels: mono
  header.writeUInt32LE(sampleRate, 24);
  header.writeUInt32LE(byteRate, 28);
  header.writeUInt16LE(2, 32); // block align
  header.writeUInt16LE(16, 34); // bits per sample
  header.write('data', 36);
  header.writeUInt32LE(pcm.length, 40);
  return Buffer.concat([header, pcm]);
}

const SYSTEM_PROMPT = `You are Jane, a warm and direct sales representative for WizAG, a Kenyan company in Nairobi.

WizAG sells:
- WizCRM — a CRM built for Kenyan SMEs: tracks leads, quotations, field visits and sales pipelines. Reps capture visit notes by voice and the CRM writes the report itself.
- Sage Evolution ERP and accounting, with local implementation and support.

You are on a live phone call with a business person in Kenya. Rules:
- Speak like a person on a phone, not a brochure. One or two short sentences, then ONE question. Never monologue.
- Sound human. Use contractions — "you're", "I'd", "that's". Open by acknowledging what they just said, briefly and specifically, before you say anything else. "Right, so everything's in spreadsheets." Vary how you phrase things; never reuse the same opener twice in one call.
- Do not narrate yourself, list features, or say "As an AI". No filler like "Certainly!" or "Great question".
- Your words are read aloud by a text-to-speech engine. No emoji, no bullet points, no markdown, no asterisks, no numbered lists. Space out acronyms so they are read as letters: write "C R M", "E R P", "Wiz A G".
- Never invent prices, discounts, customer names, or features. If asked something you do not know, say a colleague will confirm.
- You cannot book anything, send anything, or look anything up. You have no calendar, no email, no records. Never say "I will schedule", "I will send you", or "let me check". Never ask for an email address. What you CAN do is note what the person said so a WizAG colleague can call them back.
- If they sound interested, ask what day and time would suit a short demo. Once they name one, repeat it back, tell them a WizAG colleague will call to confirm it, thank them, and finish.
- If they say no, are busy, or ask to be removed: apologise once, promise no further calls, and finish.
- If the transcript is unclear or empty, ask them politely to repeat, once.
- Never claim to be a human if asked directly. Say you are an automated assistant from WizAG.

Set "endCall" to true when the conversation is genuinely finished: they declined, they named a slot for a demo and you confirmed a colleague will call, or they asked you to stop. Otherwise keep it false.

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
 *
 * Reports *why* it failed, not just that it did. An empty transcript is a
 * legitimate outcome — the caller stayed silent — and is indistinguishable from
 * a broken download unless we say which happened. A silent failure on a phone
 * call is the hardest kind to chase.
 */
export type TranscribeResult = {
  text: string;
  reason:
    | 'ok'
    | 'no_client'
    | 'fetch_failed'
    | 'http_error'
    | 'too_small'
    | 'whisper_failed'
    | 'empty_transcript';
  status?: number;
  bytes?: number;
  contentType?: string;
  detail?: string;
};

export async function transcribeRecordingUrl(url: string): Promise<TranscribeResult> {
  const client = createOpenAIClient();
  if (!client) return { text: '', reason: 'no_client' };

  let res: Response;
  try {
    res = await fetch(url, { signal: AbortSignal.timeout(RECORDING_FETCH_TIMEOUT_MS) });
  } catch (e) {
    return { text: '', reason: 'fetch_failed', detail: e instanceof Error ? e.message : String(e) };
  }
  if (!res.ok) return { text: '', reason: 'http_error', status: res.status };

  const contentType = res.headers.get('content-type') ?? undefined;
  const buf = Buffer.from(await res.arrayBuffer());
  // A near-empty file means the caller stayed silent; skip the Whisper call.
  if (buf.byteLength < 1024) {
    return { text: '', reason: 'too_small', bytes: buf.byteLength, contentType, status: res.status };
  }

  try {
    const text = (await transcribeAudio(client, buf.toString('base64'), extensionFor(url))).trim();
    return {
      text,
      reason: text ? 'ok' : 'empty_transcript',
      bytes: buf.byteLength,
      contentType,
    };
  } catch (e) {
    return {
      text: '',
      reason: 'whisper_failed',
      bytes: buf.byteLength,
      contentType,
      detail: e instanceof Error ? e.message.slice(0, 200) : String(e),
    };
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

/**
 * Render a line of Jane's speech and return the id it is cached under, so the
 * caller can build a <Play> URL. Returns null when synthesis is unavailable or
 * slow — the route then falls back to Africa's Talking' own <Say> engine, which
 * sounds worse but keeps the call alive. Never let the voice kill the call.
 *
 * Identical text is only ever synthesised once: the greeting costs a second on
 * the first call of the day and nothing on every call after it.
 */
export async function renderSpeech(text: string): Promise<string | null> {
  const id = audioIdFor(text, TTS_VOICE);
  if (hasAudio(id)) return id;

  const client = createOpenAIClient();
  if (!client) return null;

  try {
    // Raw PCM, not mp3: Africa's Talking fetched our 24 kHz mp3 and played
    // silence. We resample to 8 kHz mono WAV ourselves, which is what the
    // phone network actually carries and what every telephony player accepts.
    const res = await client.audio.speech.create(
      { model: TTS_MODEL, voice: TTS_VOICE, input: text, response_format: 'pcm' },
      { timeout: TTS_TIMEOUT_MS },
    );
    const pcm24k = Buffer.from(await res.arrayBuffer());
    if (pcm24k.byteLength < 512) return null;

    const mp3 = await encodeTelephonyMp3(pcm24k);
    if (!mp3) return null;
    putAudio(id, mp3);
    return id;
  } catch {
    return null;
  }
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
      // Two sentences fit in far less than this; the cap is a latency guard, not a style one.
      { maxTokens: 140, temperature: 0.7 },
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
 *
 * Only `&`, `<` and `>` are escaped. Quotes and apostrophes are legal in element
 * content, and escaping them risks a lax text-to-speech parser reading "&apos;"
 * out loud in the middle of "can't".
 */
export function escapeXml(text: string): string {
  return text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

/** Attribute values additionally need their quotes escaped. */
export function escapeXmlAttr(value: string): string {
  return escapeXml(value).replace(/"/g, '&quot;').replace(/'/g, '&apos;');
}
