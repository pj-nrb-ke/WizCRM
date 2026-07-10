# Voice AI on LiveKit — Jane (AI BDR) + Wanjiru (VSM), one platform

Supersedes `docs/AI-VOICE-ELEVENLABS.md`. PJ decided (2026-07-10) to run both
voice personas on LiveKit rather than splitting Jane onto ElevenLabs and
Wanjiru onto a separate WebRTC SDK — one real-time platform, one Agents
framework, two personas.

**Status: architecture confirmed and verified against LiveKit's current docs
(SDK language, SIP setup, pricing). Nothing built or live yet — waiting on
the LiveKit account.** The ElevenLabs code from PR #41 is left in place,
dormant, not deleted (see §6) pending your call.

---

## 1. Why one platform, and why LiveKit specifically

Both Jane and Wanjiru are the same underlying problem — "an AI joins a
real-time audio session and talks" — with two different front doors:

- **Jane**: the front door is a phone call, via a SIP trunk.
- **Wanjiru**: the front door is a browser tab, via WebRTC (the Meeting Room,
  already decided in `VSM-SPEC.md` §4.9).

LiveKit's SIP bridge means both front doors terminate in the same place — a
**LiveKit room** — and from there it's identical: a LiveKit Agent joins the
room, subscribes to audio, runs STT → LLM → TTS, and publishes speech back.
One codebase, two personas (system prompt + voice), two dispatch triggers.

Confirmed today, not assumed:
- **`@livekit/agents` (agents-js) is a real, actively-maintained TypeScript
  SDK** — not Python-only. It slots into the existing Node monorepo rather
  than requiring a separate Python worker service.
- **SIP setup is documented for Twilio, Telnyx, Plivo, Wavix** out of the
  box (inbound trunk + dispatch rule for incoming calls; outbound trunk for
  Jane's calls out). AfricasTalking isn't named in their docs, but the
  pattern — trunk auth, IP allow-list, phone-number mapping — matches what
  AT's own SIP-trunking help article describes. **This needs confirming
  once AT actually enables SIP trunking** (still the same pending ticket —
  see §3).
- **Pricing is real, not hopeful.** LiveKit's own Agent Session fee is
  **$0.01/minute** (Build tier: 1,000 free minutes/month). The larger cost
  is inference — OpenAI Whisper + GPT + TTS, roughly $0.04–0.07/min blended
  — which we already pay directly regardless of platform. Add the PSTN leg
  (AT ≈ $0.02/min once the trunk is live; a Twilio pilot trunk is higher).
  All-in, a call is roughly **$0.07–0.10/minute** — a few hundred call-
  minutes a month is single-digit dollars.

## 2. Architecture

```
                    ┌─────────────── LiveKit Cloud (or self-hosted later) ──────────────┐
Phone caller ─ SIP ─┤  Inbound/outbound      LiveKit Room  ← Agent (agents-js worker) │
+254730731120       │  trunk + dispatch  ──▶  "Jane" room  ←   persona: Jane          │
                     │  rule                                    STT→LLM→TTS pipeline   │
                     │                                                                  │
Staff browser ─ WebRTC ─▶ LiveKit Room  ←── Agent (same worker, different dispatch)   │
(Meeting Room UI)    │     "Scrum" room  ←   persona: Wanjiru                          │
                     └──────────────────────────────────────────────────────────────────┘
                                          │
                                          ▼
                          Post-session webhook → WizCRM
                          (lead Activity for Jane · scrum summary/Tasks for Wanjiru)
```

One `agent/` workspace (new, TypeScript, `@livekit/agents`) runs a **worker
process** that LiveKit dispatches into rooms. Which persona it loads is
decided by room metadata set at dispatch time:
- Jane: dispatch rule on the inbound/outbound SIP trunk sets
  `metadata: {persona: "jane", leadId?: ...}`.
- Wanjiru: WizCRM explicitly dispatches the agent into a scrum's room with
  `metadata: {persona: "wanjiru", meetingSessionId: ...}`.

Both personas share: the LLM call (reuse `chatJson`'s pattern, adapted to
the Agents SDK's LLM plugin interface), the "never invent prices / never
promise a booking" grounding rules already battle-tested in the AT prompt,
and `AiAuditLog` logging. They differ in: system prompt, TTS voice, and
what happens with the transcript afterward (lead Activity vs. meeting
summary + Tasks).

## 3. What does NOT change

**The AfricasTalking SIP-trunk ticket already sent stays exactly as-is.**
Nothing needs to be resent. The only thing that changes internally is which
platform sits behind the trunk — LiveKit's SIP ingress instead of
ElevenLabs' — and that's our implementation detail, not something AT needs
to know or care about. Same request, same evidence, same priority.

**The DTMF fallback on +254730731120 stays live**, unaffected, as the thing
that works today regardless of how this build goes.

## 4. What DOES change from the ElevenLabs plan

- **Platform**: LiveKit instead of ElevenLabs Agents, for both Jane and
  Wanjiru rather than just Wanjiru.
- **Language**: an in-house TypeScript agent worker (`@livekit/agents`)
  instead of calling ElevenLabs' hosted API — more code to own, but no
  per-conversation vendor markup beyond the $0.01/min platform fee, and
  full control over the prompt/pipeline for both personas in one place.
- **Voice**: free to choose any TTS the Agents SDK plugs into — OpenAI TTS
  (the `nova` voice already used in the AT experiments, this time played
  over a clean WebRTC/SIP path with none of today's 8kHz-telephony-decoder
  fighting) or ElevenLabs' TTS specifically, if its voice quality or Kenyan-
  accent options are worth keeping even though the orchestration moves off
  their Agents product.
- **What's unaffected**: the AT SIP ticket (§3), the DTMF fallback (§3), the
  KDPA disclosure requirement, the "never invent a price or a booking"
  system-prompt rules already proven out today.

## 5. Build plan

**Step 0 (PJ) — LiveKit account.** Create a LiveKit Cloud account (Build
tier, free — 1,000 Agent minutes/month, no card). Get the API key + secret
from the dashboard → `api/.env` (`LIVEKIT_URL`, `LIVEKIT_API_KEY`,
`LIVEKIT_API_SECRET`). Never paste keys into chat.

**Step 1 (me) — scaffold the agent worker.** New `agent/` workspace,
`@livekit/agents` + the OpenAI plugin (or a custom LLM adapter reusing
`chatJson`). Jane's persona first — same system prompt already written and
proven in conversation (the "she can't book, can't send email, refuses
invented pricing" version from today's AT testing). Can start before the
LiveKit account exists; cannot be *verified* until it does — same rule that
applied to the ElevenLabs build.

**Step 2 — verify cheapest-first**, mirroring the ElevenLabs runbook:
1. LiveKit's own **Agents Playground** (a hosted test UI — talk to the
   agent in a browser, no phone call, no SIP). Confirms the persona and
   pipeline work at all, for free.
2. A **pilot SIP trunk** (Twilio or Telnyx, whichever is faster to
   provision) pointed at LiveKit SIP — test a real inbound/outbound phone
   call **without waiting on AT**, same principle as the Twilio-pilot
   fallback in the old ElevenLabs plan.
3. Swap the pilot trunk for AT's once their SIP trunk is live — one
   config change in the LiveKit dashboard, no code change.
4. Post-session webhook → lead Activity. Much of `elevenlabs-voice.ts`'s
   webhook handler is directly reusable: HMAC verification pattern,
   phone-normalization lead matching, Activity-writing logic. Only the
   signature scheme and payload shape need adapting to LiveKit's webhook
   format.

**Step 3 — Wanjiru's Meeting Room** (VSM Phase 4, unchanged from
`VSM-SPEC.md` §4.9) reuses the same worker with the `wanjiru` persona,
dispatched into scrum rooms instead of SIP calls. Sequenced after Jane is
proven and after VSM Phases 0–3 (the daily task loop) ship — no change to
that ordering.

## 6. The ElevenLabs code (PR #41) — needs your call

Nothing has been deleted. `api/src/services/ai/elevenlabs.service.ts` and
`api/src/routes/elevenlabs-voice.ts` are still deployed, still unused
(`VOICE_MODE=dtmf` in prod, so neither path is live), and cost nothing to
leave in place. Options, your call:

- **(a) Leave it dormant.** Zero cost, zero risk, a working reference
  implementation of the webhook-signature/lead-matching pattern that the
  LiveKit webhook will borrow from anyway. Default if you don't say
  otherwise.
- **(b) Remove it now**, once the LiveKit path is confirmed working, in a
  small cleanup PR.

I'd lean (a) until LiveKit is proven, then (b) — but it's a one-line answer
either way, so telling me now is fine too.

## 7. Open questions for PJ

1. **Start scaffolding the LiveKit agent worker now**, or wait until the
   LiveKit account exists? (I can write the skeleton against the SDK docs
   either way; I just can't verify it runs until there's a key.)
2. **Pilot SIP trunk while waiting on AT**: Twilio (you may already have an
   account from earlier today) or Telnyx (LiveKit's docs are equally
   detailed for both)? No strong preference from me — whichever is faster
   for you to sign up for.
3. ElevenLabs code: leave dormant (my default) or remove now?
