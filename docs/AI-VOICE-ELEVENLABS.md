# Conversational Jane on ElevenLabs Agents

> **SUPERSEDED (2026-07-10).** PJ decided to run both Jane and Wanjiru (VSM)
> on **LiveKit** instead — see `docs/AI-VOICE-LIVEKIT.md` for the current
> plan. The code below (PR #41: `elevenlabs.service.ts`,
> `elevenlabs-voice.ts`) is left deployed and dormant (`VOICE_MODE=dtmf` is
> what's actually live in prod) rather than deleted — it's a working
> reference for the webhook-signature and lead-matching pattern the LiveKit
> webhook reuses. Kept for history/reference; do not build further against
> this doc.

Why we moved (from AT to ElevenLabs, the first pivot): Africa's Talking
Voice XML is turn-based (3–4 s of dead air per
turn, no interrupting the agent), and its recording retrieval 404s on an
internal host (`docs/africastalking-recording-404.md`), so the agent can never
hear the caller. ElevenLabs Agents streams both directions itself — sub-second
responses, barge-in, and the caller's speech never touches AT's recording
pipeline.

**Status: code is written and deployed but UNVERIFIED against a live ElevenLabs
account — no API key existed at build time. Run the verify section top to
bottom before trusting any of it.** The lesson of 2026-07-10 applies: a `200`
is not a working system.

## Architecture

```
WizCRM (POST /voice-agent/call)
   └─> ElevenLabs Agents  ── streams audio ──  SIP trunk ── Africa's Talking ── +254 phone
         └─> post-call webhook -> https://api.wizcrm.app/webhooks/elevenlabs/post-call
               └─> transcript + outcome written to the lead's timeline
```

Fallback telephony while the AT SIP trunk is pending: import a Twilio number in
the ElevenLabs dashboard (15-minute setup). Caveats: foreign caller ID (answer
rates in Kenya will suffer) and Twilio's Kenya mobile termination is roughly
10× AT's rate (our AT test calls cost KES 1.92 / 46 s ≈ $0.02/min).

## PJ's actions (one-time)

1. **Create an ElevenLabs account** and pick a plan. Creator ($22/mo, 275 agent
   minutes) is enough for the pilot; Pro ($99/mo, ~1 240 min) fits the
   8–10-demos/week KPI. Overage $0.08/min; the LLM cost is passed through
   (cents per call).
2. **API key** → `ELEVENLABS_API_KEY` in `api/.env` and `/opt/wizcrm/api/.env`.
   Never paste it into chat.
3. **Ask AT support to enable SIP trunking** on the account (they support it:
   help.africastalking.com → "What do I need to set up a SIP trunk connection").
   Tell them: *"We want outbound and inbound for +254730731120 to go to an
   external SIP endpoint (ElevenLabs, sip.rtc.elevenlabs.io) rather than an
   HTTP callback. What origination/termination details and IP whitelist do you
   need?"* Send it together with the recording-404 report — same ticket.
4. In the ElevenLabs dashboard: **Phone numbers → add SIP trunk** (or import a
   Twilio number for the pilot) → put its id in `ELEVENLABS_PHONE_NUMBER_ID`.
5. **Agents → workspace settings → post-call webhook** →
   `https://api.wizcrm.app/webhooks/elevenlabs/post-call`; copy the signing
   secret into `ELEVENLABS_WEBHOOK_SECRET`.

## Provision Jane

```bash
ELEVENLABS_API_KEY=$(grep ^ELEVENLABS_API_KEY api/.env | cut -d= -f2) \
  node ops/elevenlabs-provision.mjs
# prints ELEVENLABS_AGENT_ID=agent_... -> add to both .env files
```

The script is idempotent — it refuses to create a second "Jane — WizAG AI BDR"
unless `--force`. Voice defaults to a premade female voice; audition an
African-accented one in the dashboard and re-run with `--voice <id>`.

## Verify (in this order, cheapest first)

1. **Dashboard "Test agent" widget** — talk to Jane in the browser. Costs no
   phone call. Confirm: she keeps replies short, refuses pricing, never
   promises to book/send anything, ends politely on "not interested".
2. **Webhook**: make a test-widget call, then check the server:
   `journalctl -u wizcrm-api.service | grep el_voice` — expect `post_call` with
   an outcome. A `webhook_bad_signature` line means the secret is wrong.
3. **Phone call**:
   `curl -X POST https://api.wizcrm.app/voice-agent/call -H "Authorization: Bearer <mgr token>" -H "Content-Type: application/json" -d '{"to":"+2547XXXXXXXX"}'`
4. **CRM write**: call a number that exists on a lead, then check the lead's
   timeline for "AI call completed (Jane)" with transcript.

## Environment variables

| var | what |
|---|---|
| `ELEVENLABS_API_KEY` | account API key |
| `ELEVENLABS_AGENT_ID` | from the provision script |
| `ELEVENLABS_PHONE_NUMBER_ID` | id of the SIP-trunk/Twilio number in ElevenLabs |
| `ELEVENLABS_WEBHOOK_SECRET` | post-call webhook signing secret |

## What stays as it is

The AT DTMF flow (`VOICE_MODE=dtmf`) remains the live fallback on
+254730731120 until the SIP trunk moves the number. Nothing here touches it.

## Known limits / honest notes

- The ElevenLabs endpoint paths in `elevenlabs.service.ts` were written from
  their public docs and not yet exercised; if `startOutboundCall` 404s on both
  provider endpoints, check the current API reference first — the code tries
  `sip-trunk` then `twilio` variants.
- The post-call webhook attaches the call to a lead by normalized phone match
  across the deployment (single-tenant assumption) and attributes the activity
  to the org's first ADMIN.
- KDPA: the first message discloses recording and that Jane is automated. Keep
  it that way.
