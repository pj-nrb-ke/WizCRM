#!/usr/bin/env node
/**
 * Provision "Jane" — the WizAG AI BDR — as an ElevenLabs agent.
 *
 * Usage:
 *   ELEVENLABS_API_KEY=... node ops/elevenlabs-provision.mjs [--voice <voice_id>]
 *
 * Idempotence: lists existing agents first and refuses to create a duplicate
 * "Jane — WizAG AI BDR" unless --force is passed. Prints the agent_id to put
 * in api/.env as ELEVENLABS_AGENT_ID.
 */

const API = 'https://api.elevenlabs.io';
const KEY = process.env.ELEVENLABS_API_KEY;
const AGENT_NAME = 'Jane — WizAG AI BDR';

// "Sarah" — a stable premade ElevenLabs voice id, warm female. Override with
// --voice once you have auditioned voices (an African-accented one is worth it).
const DEFAULT_VOICE = 'EXAVITQu4vr4xnSDxMaL';

if (!KEY) {
  console.error('Set ELEVENLABS_API_KEY first (do not paste keys into chat or shell history:');
  console.error('  read it from api/.env:  ELEVENLABS_API_KEY=$(grep ^ELEVENLABS_API_KEY api/.env | cut -d= -f2) node ops/elevenlabs-provision.mjs');
  process.exit(1);
}

const args = process.argv.slice(2);
const voiceId = args.includes('--voice') ? args[args.indexOf('--voice') + 1] : DEFAULT_VOICE;
const force = args.includes('--force');

const PROMPT = `You are Jane, a warm and direct sales representative for WizAG, a Kenyan company in Nairobi.

WizAG sells:
- WizCRM — a CRM built for Kenyan SMEs: tracks leads, quotations, field visits and sales pipelines. Reps capture visit notes by voice and the CRM writes the report itself.
- Sage Evolution ERP and accounting, with local implementation and support.

You are on a live phone call with a business person in Kenya. Rules:
- Speak like a person on a phone, not a brochure. One or two short sentences, then ONE question. Never monologue.
- Sound human. Use contractions. Acknowledge what they just said, briefly and specifically, before saying anything else. Vary your phrasing; never reuse the same opener twice in one call.
- Never invent prices, discounts, customer names, or features. If asked something you do not know, say a colleague will confirm.
- You cannot book anything, send anything, or look anything up. You have no calendar, no email, no records. Never say "I will schedule" or "I will send you". Never ask for an email address. What you CAN do is note what the person said so a WizAG colleague calls them back.
- If they sound interested, ask what day and time would suit a short demo. Once they name one, repeat it back, say a WizAG colleague will call to confirm, thank them, and end the call.
- If they say no, are busy, or ask to be removed: apologise once, promise no further calls, and end the call.
- Never claim to be human if asked. Say you are an automated assistant from WizAG.`;

const FIRST_MESSAGE =
  "Hi there, this is Jane from Wiz A G. Just so you know, I'm an automated assistant and this call is recorded. I'll keep it short — do you have a quick minute?";

async function el(path, init = {}) {
  const res = await fetch(`${API}${path}`, {
    ...init,
    headers: { 'xi-api-key': KEY, 'Content-Type': 'application/json', ...(init.headers ?? {}) },
  });
  const text = await res.text();
  if (!res.ok) throw new Error(`${path} -> HTTP ${res.status}: ${text.slice(0, 400)}`);
  return text ? JSON.parse(text) : {};
}

// 1. Duplicate check
const existing = await el('/v1/convai/agents?page_size=100').catch(() => ({ agents: [] }));
const dupe = (existing.agents ?? []).find((a) => a.name === AGENT_NAME);
if (dupe && !force) {
  console.log(`Agent already exists: ${dupe.agent_id}`);
  console.log(`ELEVENLABS_AGENT_ID=${dupe.agent_id}`);
  console.log('Pass --force to create another anyway.');
  process.exit(0);
}

// 2. Create
const created = await el('/v1/convai/agents/create', {
  method: 'POST',
  body: JSON.stringify({
    name: AGENT_NAME,
    conversation_config: {
      agent: {
        prompt: { prompt: PROMPT },
        first_message: FIRST_MESSAGE,
        language: 'en',
      },
      tts: { voice_id: voiceId },
    },
  }),
});

console.log('Agent created.');
console.log(`  ELEVENLABS_AGENT_ID=${created.agent_id}`);
console.log('');
console.log('Next steps (docs/AI-VOICE-ELEVENLABS.md):');
console.log('  1. Add the line above to api/.env (and the server /opt/wizcrm/api/.env).');
console.log('  2. Attach a phone number (SIP trunk or Twilio) in the dashboard, put its id in ELEVENLABS_PHONE_NUMBER_ID.');
console.log('  3. Configure the post-call webhook -> https://api.wizcrm.app/webhooks/elevenlabs/post-call');
console.log('     and put its secret in ELEVENLABS_WEBHOOK_SECRET.');
console.log('  4. Test in the dashboard "Test agent" widget BEFORE any phone call.');
