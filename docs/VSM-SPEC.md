# Virtual Sales Manager (VSM) — Module Specification

Status: PLANNING — nothing here is built. Companion to `docs/AI-BDR-SPEC.md`
(the AI BDR talks to *prospects*; the VSM manages the *team*). Together they are
the "WizCRM run by AI" story: one AI fills the pipeline, the other makes sure
humans work it.

---

## 1. Vision

An AI persona that does the daily work of a competent, humane sales manager:

- Reads the CRM every morning — pipeline, stale leads, overdue tasks, targets,
  today's calendar — and decides what each person should do today.
- Assigns those tasks with a *reason* attached, over email + WizCRM tasks
  (+ mobile push in a later phase).
- Collects updates during and at the end of the day, asks follow-up questions,
  nudges silence.
- Briefs the CEO daily, and escalates only what genuinely needs a human
  decision.

The VSM never talks to customers. It manages inward; the AI BDR talks outward.

**North-star effect:** no lead goes quiet unnoticed, no rep starts the day
without a plan, and the CEO reads one brief instead of chasing five people.

## 2. Actors

| Actor | Who | What they experience |
|---|---|---|
| VSM | A dedicated system user (`isVirtual=true`, role MANAGER), configurable name/persona | Authors tasks, emails, digests. All AI output is attributable to this identity — never impersonates a human |
| Staff | Users with a Team Member Profile | Receive a morning plan, work tasks in web/mobile, reply on task threads |
| CEO / owner | Configurable user(s) | Morning plan (approve or auto), evening digest, escalations |
| Human managers | MANAGER-role users | Choice (open decision): co-managers who see everything, or managed like staff |

## 3. The daily rhythm (the heart of the module)

All times org-configurable, default Africa/Nairobi. No sends outside working
hours; no weekend sends unless enabled.

**07:30 — Morning planning run**
1. Gather context (deterministic queries, snapshotted for audit):
   stale leads by `lastActivityAt` vs stage; overdue + due-today tasks; new
   unworked leads; today's calendar events/demos per person; targets vs
   actuals; yesterday's activity counts; open escalations.
2. Rules produce *candidate actions* (see §5) — evidence-linked, deduplicated
   against open tasks.
3. LLM prioritises per person (respecting the daily cap), balances load,
   writes the human phrasing and the one-line "why".
4. Autonomy gate: `draft` → CEO approves/edits in the web app before send;
   `auto` → sends immediately, CEO gets the plan FYI.
5. Send: tasks created in WizCRM + one morning email per person ("Good morning
   Amina — 4 things today, here's why…") + push (phase 3).

**13:00 — Optional midday nudge** (off by default)
Only to people with zero movement on today's tasks. One nudge, gentle tone.

**17:30 — End-of-day collection**
Reads task states + thread replies. People with open items get a single
"anything blocking you?" prompt. Replies feed tomorrow's plan.

**18:00 — CEO evening digest**
Done / not-done / blocked by person; pipeline movement; wins; risks;
escalations needing a decision. One email + in-app.

**Friday 16:00 — Weekly review (phase 3)**
Per-rep trends, coaching observations, target trajectory.

## 4. Functional requirements

### 4.1 Team definition ("the roster") — the form PJ described
- Per user: **position/title**, **free-text description of what they do**
  (this is the text the LLM reads to decide who gets what), working days/hours,
  channels (email always; push opt-in), and whether the VSM manages them.
- Admin-editable page under Settings. Managed users must have real email
  addresses (retire `@wizag.local` seeds first — existing backlog item).

### 4.2 VSM configuration
- Persona: name, signature, tone (professional / warm / direct), language
  (English default; Swahili phrases optional later).
- Schedule: run times, working days, timezone.
- Autonomy: `draft` (CEO approves morning plan) or `auto`. **Launches in
  `draft`; `auto` is earned** after ≥2 weeks of approved-without-edits plans.
- Caps: max tasks/person/day (default 5), max nudges/person/day (default 1),
  quiet hours.
- CEO recipients list.

### 4.3 Planning engine
- **Deterministic rule layer** generates candidates — each with machine-checkable
  evidence (`leadId`, `taskId`, metric):
  R1 stale lead in active stage (thresholds per stage) → follow-up task;
  R2 overdue task → chase/reschedule;
  R3 new lead unworked >24h → first-touch task;
  R4 demo on today's calendar → prep/confirm task;
  R5 target gap vs run-rate → prospecting task;
  R6 lead thread mention unanswered → reply task;
  R7 blocked-yesterday item → follow-through task.
- **LLM layer** (existing `chatJson` provider): select/rank within caps, assign
  to the right person using roster descriptions, write title + reason.
  **The LLM may not invent a task without a rule-layer candidate behind it** —
  same grounding principle as the expo finder: no evidence, no task.
- Every run writes an `AiAuditLog` entry with the context snapshot and output.

### 4.4 Tasks (model upgrade required)
Current Task = title/dueAt only. VSM needs:
- `description` (the "what and why"), `source` (`VSM` | `USER`),
  `reason` (one-liner shown in lists), `evidence` (JSON refs), `priority`.
- **Task threads**: new `TaskUpdate` (taskId, userId, body, createdAt) so staff
  reply "called them, asked for quote by Friday" and the VSM (or a colleague)
  responds in-thread. This is the two-way channel the module stands on.
- Task completion may prompt for a short outcome note (feeds EOD digest).

### 4.5 Communications
- **Email** (Brevo SMTP — exists; remember the credential-swap gotcha):
  morning plan, follow-ups, EOD prompt, CEO digest. Reply-by-email is OUT of
  scope for MVP (inbound parsing is its own project); emails deep-link to the
  task in the web app.
- **In-app (web + mobile)**: the tasks list is the primary surface. Add a
  lightweight notification feed ("VSM assigned you 4 tasks", "VSM replied on
  ‘Chase Mombasa Ltd quote'").
- **Mobile push**: `expo-notifications` is installed but there is **no remote
  push pipeline** (no token registration, no FCM server key — and we build
  locally, so FCM must be set up by hand). Phase 3, its own workstream.

### 4.6 Response handling & follow-ups
- VSM reads thread updates on its tasks; may ask one clarifying question per
  task per day (cap prevents interrogation).
- Silence handling: no activity by EOD → counted in digest; two consecutive
  silent days → escalation candidate, not a public shaming.

### 4.7 Escalation to CEO
Escalation record: reason, evidence, suggested action, status
(OPEN/ACKNOWLEDGED/RESOLVED). Triggers (all configurable):
- High-value deal (≥ threshold) stalled ≥ N days.
- Rep unresponsive ≥ 2 working days.
- Target trajectory < X% of pace at mid-month.
- Staff explicitly flags "need management help" on a task.
Delivered in digest; CRITICAL ones send immediately.

### 4.8 CEO surfaces
- Morning: plan approval screen (draft mode) — approve all / edit / drop items.
- Evening: digest email + web page with drill-down to tasks/threads.
- Escalation inbox with acknowledge/resolve.

## 5. Guardrails & principles

1. **Grounded tasks only** — every task traces to rule-layer evidence. An AI
   manager that invents busywork is fired on day one.
2. **Respectful by construction** — caps on tasks and nudges; no punitive
   language (prompt-enforced + banned-phrase lint); quiet hours honoured;
   weekends off by default. It's a coach, not a surveillance camera.
3. **Transparent identity** — always signs as the configured persona and is
   labelled as automated. Never pretends to be PJ.
4. **Reversibility ladder** (same as AI BDR): draft → auto, and `auto` can be
   revoked with one switch.
5. **Auditable** — every run, prompt, and output in `AiAuditLog`; the CEO can
   always answer "why did it assign this?"
6. **Cheap heartbeat** — one morning run ≈ a few thousand tokens of gpt-4o-mini:
   under $1/month. Cost is not a design constraint here.

## 6. Data model (new/changed)

```
TeamMemberProfile: userId(unique) · position · responsibilities(text)
                   workingDays · workStart/End · pushOptIn · managedByVsm
VsmConfig (per org): personaName · tone · language · runTimes · autonomy
                     taskCapPerDay · nudgeCap · ceoUserIds[] · enabled
VsmRun: date · kind(MORNING/EOD/WEEKLY) · status(DRAFT/APPROVED/SENT/SKIPPED)
        contextSnapshot(json) · planJson · approvedBy? · sentAt?
Task (extend): description? · source(USER/VSM) · reason? · evidence(json)? · priority?
TaskUpdate: taskId · userId · body · createdAt
VsmEscalation: orgId · kind · severity · evidence(json) · suggestedAction
               status · createdAt · resolvedAt?
Notification: userId · kind · title · body · linkPath · readAt?   (web+mobile feed)
User (extend): isVirtual boolean (the VSM account)
```

Scheduler: system cron on the VPS hitting an internal endpoint (same pattern as
backup/watchdog) — no new runtime dependency; every run idempotent per
(org, date, kind) so a double-fire cannot double-assign.

## 7. Reuse map

| Need | Already in WizCRM |
|---|---|
| LLM | `openai.provider.ts` (`chatJson`) |
| Email | Brevo SMTP (`brevo-mail.ts`) |
| Audit | `AiAuditLog` |
| Team/roles | `User`, `Team`, role guards |
| Context | Leads/stages/`lastActivityAt`, Tasks, Calendar+availability (P1 work), reports/targets, attendance |
| Approval-UX pattern | Desk/next-action patterns on the web app |
| Cron pattern | watchdog/backup crons on the VPS |

## 8. Phasing

**Phase 0 — Foundations (schema + config)**
Roster form, VSM config page, VSM system user, Task model upgrade, TaskUpdate
threads, Notification feed (web). *Accept:* roster + config saved; a manually
triggered "dry run" produces a plan JSON visible to CEO, sends nothing.

**Phase 1 — MVP loop (draft mode)**
Morning run → CEO approval screen → tasks + per-person emails; EOD digest.
*Accept:* for 5 consecutive working days, plans generated on schedule, every
task evidence-linked, digest accurate against the DB (spot-checked), zero
sends outside working hours.

**Phase 2 — Two-way**
Task threads live in web+mobile UI; VSM follow-up questions; silence nudges;
escalations with CEO inbox. *Accept:* a staff reply gets a coherent, grounded
VSM response ≥90% of the time (human-rated on 20 samples); nudge caps hold.

**Phase 3 — Reach & polish**
Mobile push (FCM + token registry + local-build config), weekly review, Swahili
touches, `auto` mode unlock, optional WizFlow hand-off for non-sales tasks
(deferred integration per earlier decision).

## 9. Risks & honest notes

- **Adoption is the real risk, not the tech.** If staff feel policed, they'll
  route around it. Mitigations: caps, tone, staff can *push back on a task* in
  its thread and the VSM yields gracefully (reassigns/asks CEO) rather than
  repeats itself.
- **Garbage-in:** planning quality is bounded by CRM hygiene (stages, dueAt,
  activity logging). Early weeks will surface hygiene gaps — that's a feature;
  the digest should report them ("3 leads have no stage owner").
- **Seed accounts:** `@wizag.local` users can't receive email — roster setup
  forces the real-accounts migration already on the backlog.
- **Email deliverability:** morning batch to the whole team from Brevo — warm
  up gradually, correct SPF/DKIM already verified for the sending domain.
- **No reply-by-email in MVP** — deep links instead. Say it in the emails so
  nobody replies into a void.

## 10. Success metrics (after 4 weeks of Phase 1–2)

- Task completion rate ≥70%; median first-response to VSM task < 4h.
- Stale-lead count (active stages, >7 days quiet) down ≥50% from baseline.
- CEO: reads digest instead of chasing — self-reported time saved.
- Plan-approval edit rate trending to ~0 (the gate for `auto`).
- Staff thumbs-up rating on tasks ≥60% (in-app 👍/👎 on each VSM task).

## 11. Decisions (locked with PJ, 2026-07-10)

1. **Persona: female, Kenyan — working name "Wanjiru"** (name stays configurable
   in VsmConfig; email identity to provision, e.g. `manager@wizag.biz`).
2. **Autonomy: `draft` at launch.** CEO approves each morning plan; `auto`
   unlocks after ~2 weeks of unedited approvals.
3. **Human MANAGERs are managed like staff** — one consistent system; they
   receive VSM tasks like everyone else. (CEO recipients are separate.)
4. **MVP channels: email + in-app only.** Mobile push is Phase 3 (FCM/token
   workstream).

### Defaults adopted unless PJ objects
5. Working days Mon–Fri; runs 07:30 / 17:30 / 18:00 EAT.
6. Task cap 5/person/day; nudge cap 1/person/day.
7. CEO recipient: PJ only, initially.
