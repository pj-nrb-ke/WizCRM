# WizCRM AI BDR — Autonomous Demo-Booking Engine

**Status:** Spec / North-Star design · **Owner:** PJ · **Last updated:** 2026-07-07

> WizCRM already writes itself. This is the sequel: **it books your demos itself.**
> An always-on AI Business Development Rep that generates leads, engages them across
> email/WhatsApp/SMS/voice, sends proposals, and lands qualified demos on your team's calendar.

---

## 1. North Star

**One KPI governs everything: 8–10 qualified demos booked *and shown* per week** — for **SAGE Evolution ERP** and **WizCRM**.

Everything else (messages sent, replies, opens) is a diagnostic, not a goal. We optimize for **booked-and-showed demos**, which is why qualification, calendar mechanics, and no-show reduction get first-class treatment — not just outreach volume.

**Strategic bonus — dogfooding.** We're using WizCRM's own Lead Engine to sell WizCRM + SAGE. Every prospect the AI books just watched the product work. The AI BDR *is* the reference case study — build it to be shown off.

---

## 2. Governing principle

> **Automate by reversibility and blast radius — not by how impressive it looks.**

| Class | Examples | Automation stance |
|---|---|---|
| Internal + reversible | update stage, create task, clean a field, draft a message, score a lead | **Automate first** |
| External + reversible | send a WhatsApp/SMS, send a brochure | Automate **after** human-approved warm-up + evals |
| External + irreversible / commitment | AI voice call, promise pricing/terms | Automate **last**, behind the strongest guardrails |

This is what stops the machine from confidently WhatsApp-ing a prospect nonsense or getting our number blocked.

---

## 3. The funnel & the math

The AI BDR runs a five-stage funnel. Each stage has an owner (AI or human) and a conversion rate we **instrument and tune** — the numbers below are a *planning model to validate*, not promises.

```
  DISCOVER ──▶ QUALIFY ──▶ ENGAGE ──▶ PROPOSE ──▶ BOOK ──▶ [human demo]
  (Lead Engine)  (ERP fit)  (multi-ch)  (docs)    (calendar)   (your team)
```

**Working backwards from 10 demos/week:**

| Stage | Assumed conversion | Weekly volume needed |
|---|---|---|
| Demos booked (target) | — | **10** |
| Booked → showed | ~75% | book ~13 to show ~10 |
| Engaged/replied → booked | ~25–35% | ~40 positive conversations |
| Contacted → positive reply (multi-channel) | ~8–12% | **~350–500 prospects contacted** |
| Verified contacts needed (email + **phone**) | 1–1.5 / prospect | **~400–600 / week → ~1.5–2.5k / month** |

**Implication:** the machine's fuel is **verified contact data including mobile numbers** (now that we call/WhatsApp/SMS). This is the single biggest external dependency — see §9.

---

## 4. What the AI does (your four expectations, mapped)

### 4.1 Generate leads — *already built*
The **Lead Engine** discovers companies (Apify/Google Places), scores them A/B/C on fit + reputation, enriches from their website (Firecrawl), and finds decision-maker contacts (Apollo waterfall). The **Heat Map** adds live buying signals (tenders, hiring, new registrations). **No major new build** — this feeds the funnel.

### 4.2 Engage prospects — *the multi-channel build*
A single AI agent runs a **channel-orchestrated cadence** (email → WhatsApp → SMS → voice), maintaining **one conversation per prospect across all channels**, reading replies, and deciding the next touch. Requires the new **AfricasTalking channels** + a **real LLM message engine** (today's drafts are templates).

### 4.3 Send proposals — *small build on existing assets*
Brochures and price lists already live in the **Document Library**. The agent selects the right collateral for the prospect's profile and sends it (WhatsApp media / email attachment). Pricing rules configurable per product (SAGE modules vs WizCRM plans).

### 4.4 Arrange demos — ⭐ *the point of the whole system*
A **Booking Agent** reads the demo team's real calendar availability, offers slots on the prospect's channel, confirms, creates the `CalendarEvent`, and sends confirmations + reminders (crushing no-shows — and WizCRM's geofenced attendance already measures show/no-show, so the KPI self-instruments).

---

## 5. Qualification — hunt, don't spray

A demo slot is your team's scarcest resource. The AI qualifies **before** spending one.

**SAGE Evolution ERP ideal prospect** (the AI scores against this):
- **Existing-system signal** — WizCRM's Firecrawl enrichment already detects `existingErpDetected` / accounting software. A growing SME on **QuickBooks / Pastel / Excel** is a textbook SAGE upgrade target. **This is our sharpest signal — weight it heavily.**
- **Scaling signal** — Heat Map already catches **hiring finance/IT/payroll** and **tenders** → SAGE buying intent.
- Firmographics — employee band, sector, multi-entity/inventory complexity.

**WizCRM ideal prospect:** field-sales teams, reps on the road, distributors/FMCG/construction with outside sales.

The agent only advances **qualified** prospects to the ENGAGE stage; the rest stay in nurture or are dropped. This protects the 8–10/week from being junk demos.

---

## 6. Channel strategy & cadence (AfricasTalking + Brevo)

AfricasTalking is the right local backbone — Kenyan, one provider for SMS/WhatsApp/Voice, no US-centric lock-in. Orchestrate by intent; never blast all channels at once.

| Channel | Provider | Funnel role | Notes / constraints |
|---|---|---|---|
| **Email** | Brevo *(existing)* | First touch, proposals | Cheap, low risk, already wired |
| **WhatsApp** | AfricasTalking | The workhorse — highest open rate in Kenya | Needs WABA + **Meta-approved templates** for business-initiated msgs; free-form only inside the **24h customer-service window** ⚠️ |
| **SMS** | AfricasTalking | Confirmations, reminders, nudges | Cheap, high open; sender ID needed |
| **Voice (AI)** | AfricasTalking | High-intent warm-ups, live booking | **Phased** — see §7 |

**Reference cadence (tunable):**
```
Day 0   Email  — intro + relevant hook (ERP pain / field-sales pain)
Day 1   WhatsApp template — short, 1 question, opt-in
Day 3   WhatsApp (if in 24h window) — value + soft CTA to a demo
Day 5   SMS nudge — "worth a 20-min look?"
Day 7   Voice (Phase B) — IVR: "Press 1 for a demo slot"
Day 8+  On any positive signal → Booking Agent takes over → slots → confirm → remind
STOP on reply, opt-out, or booking. Opt-out honored across ALL channels.
```

---

## 7. AI voice — phased, grounded in AfricasTalking's real model

AfricasTalking Voice is a **request/response IVR model**: you place a call (`VOICE.call({ callFrom, callTo })`), AT hits your webhook, and you reply with **XML actions** (`Say`, `GetDigits`, `Record`, `Dial`, `Redirect`). It is **not** a native low-latency bidirectional audio stream, so "a chatbot that talks naturally" needs an extra bridge. Phase it:

- **Phase A (text-first):** AI books over WhatsApp/email/SMS. For hot leads, AI drafts the call script and a **human rep click-to-calls** via AT.
- **Phase B (IVR / DTMF):** AI-driven outbound voice for **narrow, low-risk jobs** — reminders, confirmations, "still interested? **press 1** and we'll book you." Uses `Say` + `GetDigits` + `Record`. Reliable, cheap, no hallucination surface. Handles Kenyan-accent/Swahili risk by keeping speech recognition out of the loop (DTMF, not open speech).
- **Phase C (conversational):** true talk-to-the-AI. Requires bridging AT (`Dial`/SIP) to a media server running a realtime voice model (e.g. OpenAI Realtime) with barge-in + **English/Swahili/Sheng** handling. Highest cost/risk. Ship only after the text funnel converts and Phase B is proven.

**Compliance for all voice:** AI-identity disclosure ("I'm an assistant from WizAG"), call-recording consent, DND respect.

---

## 8. Architecture

The AI BDR sits **on top of** existing WizCRM services (Lead Engine, Documents, Calendar, Suppression, AiAuditLog). Five new pieces:

```
                         ┌──────────────────────────────────────┐
                         │            AI BDR Agent               │
                         │  (LLM tool-use loop: qualify → engage │
                         │   → propose → book; per-prospect)     │
                         └───────────────┬──────────────────────┘
        ┌────────────────────────────────┼─────────────────────────────┐
        ▼                                ▼                              ▼
┌───────────────┐              ┌───────────────────┐          ┌──────────────────┐
│ Conversation  │              │  Channel Adapters │          │  Booking Agent    │
│ store + state │              │  Brevo | AT WA/SMS│          │ (calendar avail → │
│ (cross-chan)  │              │  | AT Voice       │          │  CalendarEvent)   │
└───────────────┘              └───────────────────┘          └──────────────────┘
        ▲                                ▲                              ▲
        └──────────── Job queue + event bus (triggers on reply/stale/booked) ───────┘
                                         │
             Retrieval/memory (pgvector over activities, docs, prior msgs)
```

1. **Agent orchestrator** — an LLM **tool-use loop** (upgrade from today's single-shot `orchestrator.ts`). Tools: `qualifyProspect`, `sendMessage(channel)`, `sendDocument`, `getAvailability`, `bookDemo`, `optOut`, `handoffToHuman`.
2. **Channel adapters** — uniform `send()` / inbound-webhook interface over **Brevo** (existing) + **AfricasTalking** WhatsApp/SMS/Voice.
3. **Conversation store** — one thread per prospect spanning all channels, with a **state machine** (§Build-01).
4. **Booking agent** — availability across the demo team (round-robin), creates `CalendarEvent`, fires confirmations/reminders (reuse existing reminder infra).
5. **Job queue + event bus** — replaces `setImmediate`/`node-cron`; fires the agent on **events** (inbound reply, lead went stale, quote sent, no-show). *This is the missing backbone for autonomy.*
6. **Retrieval/memory (pgvector)** — grounds messages in the prospect's real context and our SAGE/WizCRM knowledge. (Net-new; no embeddings today.)

Builds on existing tables: `Prospect`, `Campaign`, `Document`, `CalendarEvent`, `SuppressionList`, `AiAuditLog`. New tables in **Build 01** doc.

---

## 9. Cost model & the Apollo decision

**Verdict: yes, you need a paid contact-data plan.** Three reasons:
1. We already hit the **Apollo free-tier 404** (known open issue) — it won't sustain volume.
2. We're calling/WhatsApp-ing now → we need **verified mobile numbers**, which are a paid feature.
3. The math (§3): ~**1.5–2.5k verified contacts/month including phones** → a paid **Apollo Basic/Professional** tier, not free.

**But we're not locked in** — the Contact Finder already runs a waterfall (**Apollo → Hunter → Prospeo → Tomba → Firecrawl**) with a 30-day cache. So: buy **one** paid source sized to ~2k reveals/month (compare Apollo vs Hunter for **Kenya phone-number coverage**), and let cache + waterfall stretch it.

**Monthly cost stack to track:**

| Line item | Driver |
|---|---|
| Contact data (Apollo/Hunter paid) | ~2k verified reveals + phones / month |
| AfricasTalking | WhatsApp msgs + SMS + voice minutes |
| WhatsApp Business (Meta) | template approval, conversation fees |
| LLM (OpenAI) | agent tokens (scales with conversations) |
| **Unit economic to watch** | **Cost per booked demo** — the number that decides if this scales |

---

## 10. Autonomy & governance (non-negotiable)

- **Autonomy dial (per org / per campaign):** `off → suggest → auto-reversible → auto-all`. Start every campaign at **suggest** (human approves outbound), graduate on measured quality.
- **Unified opt-out** across email + WhatsApp + SMS + voice — extend `SuppressionList` to be channel-aware. One STOP kills all channels. **KDPA + Meta policy require this.**
- **Approval queue** — until a campaign earns trust, first-touch messages queue for one-click human approval.
- **Spend caps & rate limits** — per-day message/call/credit caps; a **kill switch**.
- **Full audit** — every agent action → `AiAuditLog` (already exists). Provenance on every booking.
- **KDPA** — lawful-basis tracking + data-subject deletion already in the Lead Engine; the agent inherits it.
- **Deliverability** — warm up sending volume; monitor bounce/block; protect domain + AT sender reputation.

---

## 11. KPI instrumentation

The booking flow emits the dashboard for free:

- **Primary:** demos booked/week, demos **shown**/week (via attendance check-in).
- **Funnel conversion:** contacted → replied → qualified → booked → shown, per channel & per campaign.
- **Efficiency:** cost per booked demo; contacts consumed per demo.
- **Quality:** show-rate, demo → opportunity conversion (does the booked demo become pipeline?).
- **Agent health:** opt-out rate, complaint/block rate, human-handoff rate.

The agent uses these to **self-tune** channel/message/time (Later phase).

---

## 12. Roadmap

| Phase | Deliverables | Risk |
|---|---|---|
| **🟢 Now** | AfricasTalking **WhatsApp + SMS** adapters · real LLM messages (kill templates) · **channel-aware opt-out** · inbound reply handling | Low |
| **🟡 Next** | **Agent + job-queue** layer · **Booking Agent** (availability → confirm → remind) · ERP-fit qualification gate · demos-per-week dashboard · retrieval layer | Med |
| **🔵 Later** | **AI Voice** (Phase B IVR → Phase C conversational) · self-tuning cadence · per-campaign hands-off autonomy | High |

**First concrete slice → `docs/AI-BDR-BUILD-01.md`:** WhatsApp adapter + Booking Agent — the shortest path to a real demo landing on your team's calendar.

---

## 13. Open decisions (need PJ input)

1. **WhatsApp Business** — do we have/can we register a **WABA** (Meta Business verification + a dedicated number)? Gate for the whole WhatsApp channel.
2. **Apollo tier** vs Hunter — pick the paid data source by **Kenya phone coverage** (I can benchmark both).
3. **Demo team calendars** — which users are the "demo pool" the Booking Agent draws availability from, and what are the bookable hours/timezone (EAT)?
4. **Sender identities** — SMS sender ID + AT voice caller-ID number to provision.
5. **Autonomy start point** — I recommend **suggest** (human approves first-touch) until evals earn auto-send. Confirm.

---

## 14. Risks

| Risk | Mitigation |
|---|---|
| AI messages customers something wrong | Human approval until evals pass; retrieval-grounded; audit + easy undo |
| Number/domain blocked | Volume warm-up, opt-out honored, complaint monitoring, spend caps |
| KDPA / Meta policy breach | Channel-aware consent + suppression, template compliance, disclosure |
| Cost runaway (calls + credits + tokens) | Per-demo cost tracking, caps, kill switch |
| Voice quality (accent/latency) | Phase B DTMF first; Phase C only after proof |
| Junk demos waste the team | Hard qualification gate on ERP-fit signal |

---

*Companion: `docs/AI-BDR-BUILD-01.md` (concrete first build). Grounded in the existing codebase: `api/src/services/lead-engine/`, `api/src/services/ai/orchestrator.ts`, Document Library, `CalendarEvent`, `SuppressionList`, `AiAuditLog`.*
