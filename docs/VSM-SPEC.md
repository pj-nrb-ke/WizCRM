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
- **KPI targets** (§4.2a) and **edit permissions** (§4.2b) — see below.

### 4.2a VSM's own KPIs — the CEO manages Wanjiru too
The CEO defines what "good" looks like *for the VSM itself*, not just for the
sales team. This makes Wanjiru accountable in the same way a human sales
manager would be, and gives the `draft` → `auto` decision an objective basis
instead of a gut call.

- Configurable per org: task-completion rate target, median response-time
  target, stale-lead reduction target, plan-edit rate ceiling (how often the
  CEO has to correct the morning plan before trusting it more).
- A **VSM Performance page** (CEO-only) shows actual vs target, trending
  weekly — reuses the existing Reports/Targets dashboard pattern.
- These are the same metrics as §10 (Success metrics), formalised as
  *editable targets* rather than fixed numbers, so the CEO can raise the bar
  over time. This is also the evidence base for granting `auto` mode.

### 4.2b Governance & edit permissions
- **VSM configuration, KPIs, and the roster can only be edited by ADMIN role
  or the designated CEO user(s).** Regular MANAGERs and SALES staff cannot
  change how Wanjiru operates, what she measures, or who she reports to —
  she is a management tool, and only management configures management tools.
- Enforced the same way admin-only settings already work today (route guard +
  hidden nav), extended to a new `requireAdminOrCeo()` guard where CEO is a
  configured user id rather than a role, since "CEO" may not always be an
  ADMIN account.
- All configuration changes are themselves logged (who changed what target,
  when) — the CEO should be able to see "task cap was raised from 5 to 7 on
  [date] by [admin]" the same way lead/opportunity history is tracked today.

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
- **Silence handling — refined, staged, and explicitly the CEO's call at the
  end, not the VSM's:**
  1. Day 1 silent (no task movement, no thread reply by EOD): noted in the
     CEO digest as a line item, nothing sent to the person beyond the normal
     EOD prompt.
  2. Day 2 silent: one gentle, named nudge from the VSM directly to the
     person ("Hi Amina, following up on yesterday's tasks — anything
     blocking you?"), still no CEO involvement.
  3. **Day 3 silent (or 2 consecutive full silent days per §4.7): escalates
     to the CEO automatically.** The VSM does not keep nudging indefinitely —
     repeated silence is exactly the situation a human decision is needed
     for, and the CEO is who decides what happens next (check in personally,
     reassign the account, etc.). The VSM's job stops at *surfacing* the
     pattern with evidence; it never takes action on a person's employment
     status or performance record.
- **Guardrail — the VSM is not a disciplinary tool.** It flags patterns with
  evidence; it never sends warnings, never says anything that reads as a
  performance judgment, and never contacts anyone above the CEO. Any
  consequence is a human decision made by the CEO outside the system.

### 4.7 Escalation to CEO
Escalation record: reason, evidence, suggested action, status
(OPEN/ACKNOWLEDGED/RESOLVED). Triggers (all configurable):
- High-value deal (≥ threshold) stalled ≥ N days.
- **Rep unresponsive ≥ 2 consecutive working days** (see staged silence
  handling in §4.6 — this is the automatic hand-off point).
- Target trajectory < X% of pace at mid-month.
- Staff explicitly flags "need management help" on a task.
- A scrum/meeting action item (§4.9) goes unresolved past its follow-up date.
Delivered in digest; CRITICAL ones send immediately. **De-duplicated**: the
same underlying issue (e.g. the same silent rep) does not generate a fresh
escalation every day — it stays OPEN and accumulates evidence until the CEO
acknowledges or resolves it, so the inbox never turns into daily spam about
the same problem.

### 4.8 CEO surfaces
- Morning: plan approval screen (draft mode) — approve all / edit / drop items.
- Evening: digest email + web page with drill-down to tasks/threads.
- Escalation inbox with acknowledge/resolve.
- VSM Performance page (§4.2a).
- Configuration audit trail (§4.2b).

### 4.9 Meeting presence — scrums and Zoom (its own tier of work)

This is the one request that is **not a natural extension** of the task/email
loop above — it's a live-audio subsystem, and worth being honest about that
up front rather than discovering it mid-build. Recommend treating it as
**Phase 4, with its own short spec**, after the core loop (Phases 0–2) has
proven itself. Two reasons: (1) it depends on Wanjiru already knowing the
team, the pipeline, and the plan — a meeting bot with no context is just a
transcript; (2) it reuses infrastructure we are *simultaneously* proving out
for Jane (the AI BDR) on ElevenLabs — streaming speech, real-time
transcription, turn-taking — so building it after that work has been
verified against a live call is far less risky than building it in parallel.

**What "attend a scrum" actually requires, broken into stages of ambition:**

*Stage A — Listen and summarise (lowest risk, real value fast)*
A meeting bot joins the Zoom call as a silent participant, transcribes the
discussion, and produces a written summary + extracted action items in
WizCRM after the meeting — attached to the relevant leads/tasks automatically
where mentioned. **No live audio response.** This alone is worth shipping on
its own: automatic scrum minutes, action items that turn into real Tasks
without anyone typing them up.

*Stage B — Respond in chat during the meeting*
The bot posts to the meeting chat (or a WizCRM-side live view PJ/CEO can
watch during the call) when it has something concrete to add — e.g. "Note:
that lead's last activity was 11 days ago" — grounded in real data, not
generic commentary. Text output, so it inherits none of the audio fragility
from today's phone-call debugging.

*Stage C — Speak in the meeting (highest ambition, highest cost/fragility)*
The bot has a synthesised voice in the call and can be addressed directly
("Wanjiru, what's the status on X?"). This needs real-time turn-detection
(don't interrupt a human mid-sentence), low-latency streaming TTS, and the
same barge-in handling the ElevenLabs work already targets for Jane — so it
is a genuine reuse of that platform once proven, not a new one.

**On "WizCRM open in the background so VSM can attend through WizCRM":**
refining this — WizCRM itself does not need to be open for Wanjiru to be in
the meeting. The clean architecture is a **meeting bot** (via a service like
Recall.ai, or Zoom's own meeting-bot SDK) that joins the Zoom call directly
as a named participant ("Wanjiru — WizCRM"), independent of anyone's browser
tab. This is more reliable than capturing audio from a machine that happens
to have both Zoom and WizCRM open (that approach breaks if the laptop sleeps,
the tab is backgrounded, or the wrong person is running it), and it means
Wanjiru can join a scrum even if PJ isn't the one who scheduled it.

**Consent & KDPA:** exactly the disclosure principle already in place for
Jane on the phone (§ AI-BDR docs) — the meeting invite states a recording
AI participant will attend, and the bot announces itself on joining. Non-
negotiable given Kenya's Data Protection Act, doubly so here since it's
recording colleagues, not prospects.

**Data model addition:** `MeetingSession` (date, participants, transcript,
summary, zoomMeetingId) and `MeetingActionItem` (meetingId, description,
assigneeId?, linkedTaskId?, dueDate?, status) — action items promote into
real Tasks the same way rule-layer candidates do, so they inherit the same
grounding and CEO-visibility guarantees as everything else in this spec.

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
7. **Never a disciplinary tool** (§4.6) — flags patterns with evidence;
   consequences are always a human decision made by the CEO.
8. **Management-only configuration** (§4.2b) — only ADMIN/CEO can change what
   Wanjiru measures, whom she manages, or how she behaves.
9. **Consent before recording** (§4.9) — any meeting/audio presence discloses
   itself on joining, same as the AI BDR's phone disclosure. No silent
   listening.

## 6. Data model (new/changed)

```
TeamMemberProfile: userId(unique) · position · responsibilities(text)
                   workingDays · workStart/End · pushOptIn · managedByVsm
VsmConfig (per org): personaName · tone · language · runTimes · autonomy
                     taskCapPerDay · nudgeCap · ceoUserIds[] · enabled
                     kpiTargets(json)                              -- §4.2a
VsmConfigChange: orgId · field · oldValue · newValue · changedBy · at   -- §4.2b audit trail
VsmRun: date · kind(MORNING/EOD/WEEKLY) · status(DRAFT/APPROVED/SENT/SKIPPED)
        contextSnapshot(json) · planJson · approvedBy? · sentAt?
Task (extend): description? · source(USER/VSM) · reason? · evidence(json)? · priority?
TaskUpdate: taskId · userId · body · createdAt
VsmEscalation: orgId · kind · severity · evidence(json) · suggestedAction
               status · createdAt · resolvedAt?
               -- de-duplicated: same underlying issue accumulates evidence
               -- on one OPEN record rather than creating a new one (§4.7)
Notification: userId · kind · title · body · linkPath · readAt?   (web+mobile feed)
User (extend): isVirtual boolean (the VSM account)

-- Phase 4 (meeting presence, §4.9) — separate from the core loop:
MeetingSession: orgId · zoomMeetingId · scheduledFor · participants[]
                transcript · summary · status
MeetingActionItem: meetingId · description · assigneeId? · linkedTaskId?
                   dueDate? · status
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
| Admin-only settings pattern | existing admin-guarded routes/nav (§4.2b reuses this) |
| Streaming voice (Phase 4, §4.9) | the ElevenLabs Agents integration being verified for Jane right now — same platform, once proven on a phone call |

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
touches, `auto` mode unlock, VSM Performance page (§4.2a), optional WizFlow
hand-off for non-sales tasks (deferred integration per earlier decision).

**Phase 4 — Meeting presence (§4.9)**
Own short spec once scoped. Ships in the three stages described in §4.9:
(A) silent bot → transcript + summary + action items (ship this alone first —
real value, lowest risk); (B) grounded text contributions during the call;
(C) live spoken participation, built on the ElevenLabs platform once it is
proven for Jane. *Accept for Stage A:* a scrum produces an accurate written
summary and every stated action item lands as a linked Task within minutes
of the meeting ending.

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
- **Meeting presence is the highest-risk feature in this spec, technically
  and socially.** Technically: live meeting audio is a different subsystem
  from anything else here, with its own cost (a per-minute meeting-bot
  service) and failure modes. Socially: a bot that speaks up in a human scrum
  can easily feel intrusive or comic if it gets timing or tone wrong — Stage A
  (silent transcription + summary) de-risks this by proving the value before
  anyone has to get used to a synthetic voice interrupting a meeting.

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

## 12. New from this round (2026-07-10, second pass) — for PJ's review

Refined from PJ's requests, plus items I'm adding:

1. **VSM config/KPIs editable only by ADMIN or CEO** (§4.2b) — added.
2. **CEO sets KPIs for the VSM itself**, not just for the sales team (§4.2a) —
   added, with a Performance page and audit trail of who changed what.
3. **Staff silence escalates to the CEO** (§4.6/§4.7) — refined into a staged
   response (day 1 noted → day 2 nudged → day 3 escalated) rather than an
   immediate page, so the CEO isn't interrupted by a single quiet afternoon,
   and escalations de-duplicate so the same silent rep doesn't spam the inbox
   daily.
4. **Scrums with CEO + Wanjiru attending, via Zoom** (§4.9) — scoped into
   three stages of ambition (listen+summarise → grounded chat → live voice),
   recommended as its own **Phase 4** after the core loop and the ElevenLabs
   voice platform are both proven, rather than built alongside Phases 0–2.
5. **My addition — guardrail: never a disciplinary tool.** Given point 3
   above puts the CEO in the loop on staff silence, it's worth stating
   explicitly that the VSM surfaces patterns and never issues anything that
   reads as a warning or performance judgment. Keeps this a coaching tool,
   not a surveillance one — which is also what protects adoption (§9).
6. **My addition — configuration change audit trail.** Since only
   ADMIN/CEO can edit VSM settings, the system should also show *who* changed
   *what* and *when* (e.g. "task cap raised 5→7"), the same way lead/
   opportunity history already works. Governance without a paper trail is
   just a permission check nobody can verify later.
7. **My addition — meeting bot is an explicit external cost.** Live meeting
   presence (Stage A onward) needs a per-minute meeting-bot service
   (Recall.ai or similar) in addition to ElevenLabs — worth pricing out before
   committing to Phase 4, separately from the ElevenLabs pilot cost.

### Open decisions for this round
8. Approve the Phase 4 (meeting presence) scoping as-is, or is it more
   urgent than Phases 0–3 — i.e. should scrums come *before* the daily
   task loop rather than after?
9. Meeting-bot vendor preference, or should I research options (Recall.ai
   vs Zoom's native meeting SDK vs alternatives) before deciding?
10. Should Stage A (silent transcription + summary) alone be pulled forward
    as a small standalone feature, independent of the rest of VSM? It has
    real value on its own and no dependency on the daily-planning loop.
