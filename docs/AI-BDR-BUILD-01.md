# AI BDR — Build 01: WhatsApp Adapter + Booking Agent

**Status:** Build design (ready to implement) · **Companion to:** `docs/AI-BDR-SPEC.md`

> **The thin vertical slice that lands one real demo on your team's calendar, booked by the AI over WhatsApp.**
> Everything else (SMS, email orchestration, voice, durable queue, retrieval, self-tuning) is a later build.
> Prove the loop first; scale second.

---

## 1. Goal & definition of done

**Goal:** A qualified test prospect receives an AI-run WhatsApp conversation that qualifies them, proposes real open slots from the demo team's calendar, books one, creates a `CalendarEvent`, and sends a confirmation — with **human approval on first touch**, **opt-out honored**, and **every action audited**.

**Definition of Done:**
- [ ] AI sends a WhatsApp message via AfricasTalking (sandbox → then production WABA).
- [ ] Inbound WhatsApp replies land via webhook and drive the conversation.
- [ ] The agent proposes **actual free slots** from the demo pool's real calendar.
- [ ] Booking creates a `CalendarEvent` + `DemoBooking` and sends a confirmation message.
- [ ] `STOP`/opt-out kills the conversation and suppresses the number.
- [ ] First-touch outbound waits in an **approval queue** (autonomy = `suggest`).
- [ ] Every AI/agent action is written to `AiAuditLog`.
- **Success = one real demo on the calendar, booked by the AI.**

---

## 2. Scope

**In:** WhatsApp only · conversation store + state machine · booking agent (availability → CalendarEvent → confirmation/reminder) · human approval queue · channel-aware opt-out · audit.

**Out (later builds):** SMS/email/voice channels · durable job queue + event bus (Build 01 triggers the agent inline from the webhook, fire-and-forget, like the existing discovery runs — flagged as debt) · pgvector retrieval (use prospect fields for context) · self-tuning cadence · full autonomy · multi-channel orchestration.

**Reuses (already in the codebase):** `Prospect` / `Lead` / `Campaign`, Document Library, `CalendarEvent`, `SuppressionList`, `AiAuditLog`, the public webhook pattern (`/webhooks/brevo` with constant-time secret compare), `config.ts` env gating, `openai.provider.ts`.

---

## 3. Happy path (sequence)

```
Qualified Prospect (from Lead Engine)
    │
    ▼  operator/agent starts conversation
[Approval queue] ──approve──▶ AT WhatsApp: template first-touch ──▶ prospect's phone
                                                                        │
                     prospect replies "yes, interested"  ◀─────────────┘
                                                                        │
   POST /webhooks/africastalking/whatsapp ──▶ store INBOUND ──▶ open 24h window
                                                                        │
                                          runConversationTurn(conversationId)
                                                                        │
            LLM (tool-use): qualify() ✓  →  proposeSlots() ──▶ availability.service
                                                                        │
                     "Great — I can do Tue 10:00 or Wed 14:00 EAT?"  ──▶ prospect
                                                                        │
                              "Wed works"  ◀───────────────────────────┘
                                                                        │
                          bookDemo({slot: Wed 14:00, product: SAGE})
                                   │
             creates CalendarEvent + DemoBooking(CONFIRMED), assigns demo rep
                                   │
             confirmation WhatsApp + scheduled reminder  ──▶ prospect
                                   │
                        📅 Demo on your team's calendar
```

---

## 4. Data model (Prisma additions)

`api/prisma/schema.prisma` — UUID PKs, `organizationId`-scoped, following existing conventions.

```prisma
enum BdrChannel { WHATSAPP SMS EMAIL VOICE }

enum BdrConversationState {
  NEW               // created, no outbound yet
  AWAITING_APPROVAL // first-touch queued for human approval
  ENGAGED           // prospect replied, in dialogue
  QUALIFYING
  PROPOSING         // sending collateral / pitching
  OFFERING_SLOTS
  AWAITING_CONFIRM
  BOOKED
  OPTED_OUT
  HANDOFF           // escalated to a human
  STALLED           // no reply within window
  CLOSED
}

enum BdrDirection { INBOUND OUTBOUND }

enum BdrMessageStatus {
  PENDING_APPROVAL QUEUED SENT DELIVERED READ FAILED RECEIVED
}

enum DemoProduct { SAGE_EVOLUTION WIZCRM }

enum DemoBookingStatus { PROPOSED CONFIRMED SHOWED NO_SHOW CANCELLED }

model BdrConversation {
  id             String   @id @default(uuid())
  organizationId String
  campaignId     String?
  prospectId     String?
  leadId         String?
  channel        BdrChannel            @default(WHATSAPP)
  customerNumber String                // E.164, e.g. +2547...
  state          BdrConversationState  @default(NEW)
  assignedUserId String?               // demo rep once booked / human on handoff
  windowExpiresAt DateTime?            // WhatsApp 24h free-form window
  lastInboundAt  DateTime?
  lastOutboundAt DateTime?
  optedOutAt     DateTime?
  createdAt      DateTime @default(now())
  updatedAt      DateTime @updatedAt

  messages BdrMessage[]
  booking  DemoBooking?

  @@index([organizationId, state])
  @@index([organizationId, customerNumber])
}

model BdrMessage {
  id                 String   @id @default(uuid())
  conversationId     String
  direction          BdrDirection
  channel            BdrChannel        @default(WHATSAPP)
  body               String            // rendered text
  mediaUrl           String?
  templateName       String?           // set when sent as an approved template
  providerMessageId  String?           // AfricasTalking message id (for status callbacks)
  status             BdrMessageStatus
  aiGenerated        Boolean           @default(false)
  approvedByUserId   String?
  createdAt          DateTime @default(now())

  conversation BdrConversation @relation(fields: [conversationId], references: [id], onDelete: Cascade)

  @@index([conversationId, createdAt])
  @@index([providerMessageId])
}

model DemoBooking {
  id              String   @id @default(uuid())
  organizationId  String
  conversationId  String   @unique
  calendarEventId String   // FK to existing CalendarEvent
  prospectId      String?
  leadId          String?
  product         DemoProduct
  slotStart       DateTime
  assignedUserId  String   // the demo rep
  status          DemoBookingStatus @default(CONFIRMED)
  createdAt       DateTime @default(now())

  conversation BdrConversation @relation(fields: [conversationId], references: [id])

  @@index([organizationId, slotStart])
}
```

**Opt-out (channel-aware) — extend existing `SuppressionList`:**
```prisma
// add to SuppressionList
channel BdrChannel?   // null = ALL channels (back-compat); else channel-specific
```
Opt-out matching becomes: suppress if a row matches the number/email/domain **and** (`channel IS NULL OR channel = :channel`).

> `Prospect`/`Lead` already carry phone; store the E.164 WhatsApp number on the conversation. Opt-in for Build 01 is established by the prospect's inbound reply (implied consent to continue) + WABA template opt-in language on first touch.

---

## 5. Config & env (`api/src/config.ts` + `.env.example`)

Follow the existing "graceful-when-absent" pattern (like `aiEnabled`):

```
AT_USERNAME=            # AfricasTalking username ('sandbox' in dev)
AT_API_KEY=             # apiKey header
AT_WA_NUMBER=           # your WhatsApp Business number (waNumber)
AT_WA_WEBHOOK_SECRET=   # shared secret for inbound webhook (constant-time compared)
BDR_AUTONOMY=suggest    # suggest | auto
BDR_DEMO_POOL_USER_IDS= # comma-sep userIds who take demos
BDR_SLOT_MINUTES=45
BDR_LOOKAHEAD_DAYS=5
BDR_DAILY_MESSAGE_CAP=200
BDR_WORK_HOURS=09:00-17:00   # EAT
```
`config.bdrEnabled = Boolean(AT_API_KEY && AT_USERNAME && AT_WA_NUMBER)`; when false, adapters no-op and routes 503 (mirrors the AI/email gating).

---

## 6. WhatsApp channel adapter

`api/src/services/channels/africastalking/whatsapp.provider.ts` — grounded in the verified AT contract (`POST chat.africastalking.com/whatsapp/message/send`, `apiKey` header, JSON `{ username, waNumber, phoneNumber, body }`).

```ts
export interface ChannelAdapter {
  sendText(to: string, text: string): Promise<{ providerMessageId: string }>;
  sendTemplate(to: string, name: string, language: string, vars: string[]): Promise<{ providerMessageId: string }>;
  sendMedia(to: string, mediaUrl: string, caption?: string): Promise<{ providerMessageId: string }>;
}

const BASE = 'https://chat.africastalking.com/whatsapp/message/send';

async function post(body: unknown) {
  const res = await fetch(BASE, {
    method: 'POST',
    headers: {
      apiKey: config.atApiKey,
      'Content-Type': 'application/json',
      Accept: 'application/json',
    },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(`AT WhatsApp ${res.status}: ${await res.text()}`);
  return res.json();
}

export const whatsappAdapter: ChannelAdapter = {
  async sendText(to, text) {
    const r = await post({
      username: config.atUsername,
      waNumber: config.atWaNumber,
      phoneNumber: to,                     // E.164
      body: { message: text },
    });
    return { providerMessageId: extractId(r) };
  },
  async sendTemplate(to, name, language, vars) {
    const r = await post({
      username: config.atUsername, waNumber: config.atWaNumber, phoneNumber: to,
      body: { template: { name, language, components: vars } },
    });
    return { providerMessageId: extractId(r) };
  },
  async sendMedia(to, mediaUrl, caption) {
    const r = await post({
      username: config.atUsername, waNumber: config.atWaNumber, phoneNumber: to,
      body: { media: { url: mediaUrl, caption, mediaType: 'image' } },
    });
    return { providerMessageId: extractId(r) };
  },
};
```

**24h-window rule (enforced by the send layer, not the model):**
- Inside the window (prospect messaged us < 24h ago) → free-form `sendText` allowed.
- Outside the window → **must** use `sendTemplate` (Meta rule). If no approved template applies, the message is held for human handling. `windowExpiresAt` on the conversation gates this.

---

## 7. Inbound webhook + status callbacks

`api/src/routes/africastalking.ts` (public, registered in `app.ts` beside `/webhooks/brevo`).

```
POST /webhooks/africastalking/whatsapp          # inbound messages
POST /webhooks/africastalking/whatsapp/status   # delivery/read receipts
```

**Inbound handler:**
1. Verify `AT_WA_WEBHOOK_SECRET` (header or query, **constant-time compare** — reuse the Brevo pattern).
2. Parse `{ from, waNumber, text/mediaUrl, messageId }` (Zod schema in `shared`).
3. Find or create `BdrConversation` by `(organizationId, customerNumber)`; append `BdrMessage(INBOUND, RECEIVED)`; set `lastInboundAt = now`, `windowExpiresAt = now + 24h`.
4. **Opt-out check first:** if body matches `STOP|UNSUBSCRIBE|OPT OUT|ACHANA` → add channel-aware `SuppressionList` row, set state `OPTED_OUT`, send a template confirmation, **stop**.
5. Else → `runConversationTurn(conversationId)` (Build 01: inline/fire-and-forget; Next: enqueue).

**Status handler:** map AT status → `BdrMessageStatus` on the matching `providerMessageId` (`SENT/DELIVERED/READ/FAILED`).

---

## 8. The conversation agent (LLM tool-use)

`api/src/services/bdr/agent.service.ts`. Upgrades the single-shot pattern to a **tool-use loop** (extend `openai.provider.ts` with function-calling; keep JSON discipline + auditing).

```ts
async function runConversationTurn(conversationId: string) {
  const convo = await loadConversation(conversationId);       // + history + prospect ctx
  if (convo.state === 'OPTED_OUT' || convo.optedOutAt) return;
  if (await isRateCapped(convo)) return;

  const { text, toolCalls, nextState } = await bdrLlm({
    system: BDR_SYSTEM_PROMPT,                                 // persona + rules below
    context: prospectContext(convo),                           // company, ERP signal, sector
    history: convo.messages,
    tools: [qualify, proposeSlots, bookDemo, sendDocument, optOut, handoff],
  });

  for (const call of toolCalls) await execTool(call, convo);   // guarded (see §guardrails)

  if (text) await deliverOutbound(convo, text, { aiGenerated: true });
  await setState(convo, nextState);
  await audit('bdr_turn', convo, { text, toolCalls });         // → AiAuditLog
}
```

**Tools (each maps to a guarded service call):**
| Tool | Backed by | Guard |
|---|---|---|
| `qualify()` | ERP-fit scorer (uses `existingErpDetected`, sector, size) | read-only |
| `proposeSlots()` | `availability.service` (real calendar) | read-only |
| `bookDemo({slotStart, product})` | `booking.service.createBooking` | slot must be from a fresh `proposeSlots` |
| `sendDocument({docId})` | Document Library | doc must be active + org-scoped |
| `optOut()` | suppression | terminal |
| `handoff({reason})` | assign `assignedUserId`, notify | terminal for AI |

**System prompt (intent):** *"You are WizAG's BDR assistant. Goal: book a 45-min demo of SAGE Evolution ERP and/or WizCRM. Qualify first (are they outgrowing QuickBooks/Pastel/Excel? field-sales team?). Be concise and WhatsApp-appropriate. Offer only slots returned by the proposeSlots tool. Never invent pricing or commitments — send the price list document instead. If asked, disclose you're an AI assistant. Honor any opt-out immediately."*

**`deliverOutbound`** applies autonomy: `suggest` → save `PENDING_APPROVAL` (no send); `auto` → send via adapter (respecting the 24h/template rule) and record `providerMessageId`.

---

## 9. Availability + booking

`api/src/services/bdr/availability.service.ts`
```ts
// Real free/busy over the demo pool, EAT working hours, next N business days.
async function findSlots(orgId: string, opts: { minutes: number; count: number }): Promise<Slot[]> {
  const pool = config.bdrDemoPoolUserIds;
  const busy = await prisma.calendarEvent.findMany({
    where: { organizationId: orgId, userId: { in: pool }, startAt: { gte: now, lte: horizon } },
  });
  // generate candidate slots in BDR_WORK_HOURS, drop overlaps, round-robin assign a rep
  return roundRobinFreeSlots(pool, busy, opts);
}
```

`api/src/services/bdr/booking.service.ts`
```ts
async function createBooking(convo, slot, product): Promise<DemoBooking> {
  const rep = slot.assignedUserId;
  const event = await createCalendarEvent({           // existing service
    organizationId: convo.organizationId, userId: rep,
    title: `${label(product)} demo — ${companyName(convo)}`,
    startAt: slot.start, endAt: addMinutes(slot.start, config.bdrSlotMinutes),
    leadId: convo.leadId, notes: `Booked by AI BDR via WhatsApp. Contact: ${convo.customerNumber}`,
  });
  const booking = await prisma.demoBooking.create({ data: {
    organizationId: convo.organizationId, conversationId: convo.id, calendarEventId: event.id,
    product, slotStart: slot.start, assignedUserId: rep, status: 'CONFIRMED',
    prospectId: convo.prospectId, leadId: convo.leadId,
  }});
  await setState(convo, 'BOOKED');
  await deliverOutbound(convo, confirmationText(event, rep));   // confirmation
  await scheduleReminder(convo, event);                          // reuse reminder infra
  await audit('bdr_booking', convo, { eventId: event.id });
  return booking;
}
```
No-show handling and multi-reminder cadence come in Build 02; Build 01 sends one confirmation + one day-before reminder. Show/no-show is later reconciled from the existing **attendance check-in** on the `CalendarEvent`.

---

## 10. Approval queue & guardrails (Build 01)

**Approval endpoints** (`api/src/routes/bdr.ts`, manager-gated):
```
GET  /bdr/approvals                 # PENDING_APPROVAL outbound messages
POST /bdr/approvals/:messageId/approve   # → send now via adapter
POST /bdr/approvals/:messageId/reject
GET  /bdr/conversations/:id         # thread view (for oversight)
```

**Guardrails enforced in code:**
- **Autonomy = `suggest`** by default → first-touch (and every AI outbound, until you flip to `auto`) queues for one-click approval.
- **Opt-out** checked before every turn; channel-aware suppression; terminal.
- **24h window / template** rule enforced by the send layer (§6).
- **Rate caps** — per-conversation/day + global `BDR_DAILY_MESSAGE_CAP`; kill switch = set `BDR_AUTONOMY=off`/disable env.
- **Audit** — every turn, send, and booking → `AiAuditLog`.

---

## 11. Zod schemas (`shared/src/schemas.ts`)

- `atWhatsAppInboundSchema` — inbound webhook payload.
- `atWhatsAppStatusSchema` — delivery status payload.
- `bdrSendSchema`, `bdrBookingSchema` — internal.
(Consistent with existing shared-schema validation used across routes.)

---

## 12. Sequenced PRs

| PR | Title | Contents | Verify |
|---|---|---|---|
| **PR1** | BDR schema + WhatsApp send | Prisma models/enums + migration, config/env, `whatsapp.provider.ts` (send), suppression `channel` column | Send a WhatsApp to your own number via AT **sandbox** |
| **PR2** | Inbound webhook + conversation store | `routes/africastalking.ts` (inbound + status), Zod schemas, conversation/message persistence, **opt-out** | Reply in sandbox → INBOUND stored, 24h window set, `STOP` suppresses |
| **PR3** | Availability + booking | `availability.service`, `booking.service`, CalendarEvent + DemoBooking + confirmation/reminder | Unit tests; a booking appears on the demo rep's calendar |
| **PR4** | Conversation agent + approvals | tool-use loop, `bdr/agent.service.ts`, approval queue routes, audit, caps | **End-to-end in sandbox: approve first touch → converse → book → event on calendar** |

Each PR is independently mergeable and testable; PR4 completes the Definition of Done.

---

## 13. Testing

- **AT sandbox** (`AT_USERNAME=sandbox`) + AT's WhatsApp simulator / a test number for send + inbound round-trip.
- **Unit tests** (existing `api/tests` harness): availability generation, slot-overlap exclusion, state-machine transitions, opt-out matching, 24h-window gating.
- **Prod gate:** a **Meta-approved WABA + template** is required before real business-initiated sends — provision in parallel (an [Open decision](AI-BDR-SPEC.md#13-open-decisions-need-pj-input) in the spec).

---

## 14. Known debt to retire in later builds

- **Inline agent trigger** (fire-and-forget from webhook) → replace with the **durable job queue + event bus** (Spec §8).
- **Prospect-field context** → replace with **pgvector retrieval** for richer grounding.
- **Single confirmation/reminder** → full no-show-reduction cadence + reconciliation from attendance.
- **WhatsApp only** → add SMS/email into the same conversation store, then Voice (Phase B IVR).

---

*Companion strategy: `docs/AI-BDR-SPEC.md`. Reuses: Lead Engine, Document Library, `CalendarEvent`, `SuppressionList`, `AiAuditLog`, the `/webhooks/brevo` secret-compare pattern, and `openai.provider.ts`.*
