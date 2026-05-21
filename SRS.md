# WizCRM — Software Requirements Specification (SRS)

| Field | Value |
|-------|--------|
| **Product** | WizCRM — AI-driven CRM for sales and field teams |
| **Organization** | Wise & Agile Solutions Ltd (WIZAG) |
| **Document version** | 2.2 |
| **Date** | 2026-05-17 |
| **Status** | Active — AI-first product; tiered Lite / Pro / Enterprise |
| **Related docs** | [WizCRM Features.md](./WizCRM%20Features.md), [SRS-WEB.md](./SRS-WEB.md), [PROGRESS_TRACKER.md](./PROGRESS_TRACKER.md), [LEAD_LIFECYCLE.md](./LEAD_LIFECYCLE.md), [manager_tasks.md](./manager_tasks.md), [manager_task_tracker.md](./manager_task_tracker.md) |

**Supersedes:** SRS v1.x (user-driven CRM feature list). v1 scope is archived in git history (commit before v2.0).

---

## 1. Product vision

### 1.1 Positioning

WizCRM is an **AI sales operating system**, not a traditional CRM where reps fill forms.

> **Reps talk, meet, and close. AI captures work, updates the CRM, recommends next actions, drafts follow-ups, and gives managers visibility—after human approval where it matters.**

**Market message:** Do not sell “CRM with AI features.” Sell **AI that does the CRM work**.

### 1.2 Core principle

| Traditional CRM | WizCRM (AI-first) |
|-------------------|-------------------|
| User enters lead details manually | AI captures and enriches; user confirms minimum fields |
| User updates stage manually | AI suggests stage from activity; user approves |
| User writes long call notes | User speaks or types rough note; AI structures timeline |
| User remembers follow-up | AI creates follow-up task and draft message |
| Manager digs through reports | AI delivers summaries and exceptions |
| User builds quote from scratch | AI drafts quote from conversation; user approves |

**Daily user loop:** Talk to prospects → **Approve AI suggestions** → Close business.

### 1.3 Product tiers

One brand — **WizCRM** — three plans:

| Tier | Timeline (target) | Audience |
|------|-------------------|----------|
| **Lite** | ~1 week | Internal WIZAG teams; internal buy-in pilot |
| **Pro** | ~1 month after Lite | ~80% of paying customers; mainstream SaaS |
| **Enterprise** | Multi-month after Pro | Full platform: field proof, ERP, advanced security |

**ScaleGate** (external licensing API) maps entitlements: `wizcrm_lite`, `wizcrm_pro`, `wizcrm_enterprise` (see §8).

### 1.4 Design rules (all tiers)

1. **Smallest possible input** from the user; AI produces structured CRM data.
2. **Approve before send** — outbound messages, quotes, and high-impact stage changes require explicit user approval (Lite/Pro); Enterprise may add policy-based auto-apply above confidence thresholds (configurable).
3. **AI audit** — log what AI suggested, what the user approved, and model/prompt version where applicable.
4. **Fallback** — if AI or network fails, user can always save a minimal manual note and basic fields.
5. **Privacy** — voice, images, and message content sent to LLM only per tenant policy; document in privacy policy (see [manager_tasks.md](./manager_tasks.md)).

### 1.5 Out of scope (all tiers at start)

- WizCRM is not a replacement for full marketing automation, payroll, or generic workflow builders (Enterprise may add limited automation later).

---

## 2. AI module map (logical architecture)

| Module | Lite | Pro | Enterprise |
|--------|:----:|:---:|:----------:|
| AI Lead Capture | ● | ● | ● |
| AI Sales Desk | ● basic | ● full | ● full |
| AI Lead Detail (summary, next action) | ● | ● | ● |
| AI Activity Capture | ● | ● | ● |
| AI Follow-up Engine | ○ basic | ● | ● |
| AI Pipeline & Forecasting | ○ minimal | ● | ● advanced |
| AI Communication Assistant | ○ | ● | ● |
| AI Manager Cockpit | ○ | ● | ● |
| AI Targets & Performance | — | ● | ● |
| Quotations | — | ● Lite | ● + ERP |
| AI Data Hygiene | — | ● light | ● |
| AI Field Sales (geofence, visits) | — | — | ● |
| ERP integration | — | — | ● |
| Multi-tenant SaaS + ScaleGate | — | ● | ● |
| Advanced integrations (calendar, email sync, webhooks) | — | — | ● |

● = included · ○ = limited · — = not in tier

---

## 3. WizCRM Lite (~1 week, internal pilot)

**Goal:** Demo-ready **AI-assisted CRM** for internal team buy-in. **Single organization**; no ScaleGate production, no multi-tenant, no geofence, no ERP.

**Definition of done:** Rep scans card or adds lead → sees daily priorities → logs call in under one minute → reads AI lead summary → manager can view lead list and stages (read-only list acceptable).

### 3.1 Requirements (LITE-*)

| ID | Requirement | Acceptance |
|----|-------------|------------|
| LITE-001 | **Lead Inbox** — create lead with name + (phone OR email); company optional | Create in &lt; 20 s |
| LITE-002 | **Duplicate check** on phone / email | Warning before save |
| LITE-003 | **Business card capture** — photo → AI/OCR extract → prefill form → user confirms | Fields editable before save |
| LITE-004 | **Stages** — New, Contacted, Qualified, Proposal, Negotiation, Won, Lost | AI may suggest; user confirms change |
| LITE-005 | **AI Sales Desk (basic)** — “Do today” list (3–5 items): hot leads, due follow-ups | Rules-based OK; LLM optional |
| LITE-006 | **AI Lead Summary** — plain-language status on lead detail | Regenerate on new activity |
| LITE-007 | **AI Next Action** — one recommended action per lead | User can dismiss or complete |
| LITE-008 | **Activity** — quick text note; optional short **voice note → AI cleaned note** | Timeline entry created |
| LITE-009 | **Post-call prompt (mobile, Android priority)** — attach call → rough input → AI summary + suggested task | User confirms save |
| LITE-010 | **Timeline** — notes, calls, stage changes | Chronological list |
| LITE-011 | **Tasks** — simple follow-up with due date; AI may create; user edits | Mark complete |
| LITE-012 | **Pipeline** — simple list grouped by stage (Kanban optional) | View only |
| LITE-013 | **Auth** — simple login for internal users (single org) | No public signup |
| LITE-014 | **Platform** — mobile-first; minimal web optional | Expo app runs on emulator/device |

### 3.2 Explicitly not in Lite

Multi-tenant, ScaleGate, manager AI cockpit, quotations, geofence, ERP, email/WhatsApp auto-capture, full lead scoring, web lead forms, CSV export (optional nice-to-have).

---

## 4. WizCRM Pro (~1 month, mainstream)

**Goal:** **AI sales operating system** for typical SMB sales teams. **Multi-tenant SaaS**, **ScaleGate** licensing, web + mobile. **No** geofence, **no** ERP sync (stubs allowed).

**Builds on:** all Lite capabilities, hardened and expanded.

### 4.1 Requirements (PRO-*)

| ID | Area | Requirement |
|----|------|-------------|
| PRO-001 | Lead Capture | Smart lead create; AI suggests source and priority (Hot/Warm/Cold) |
| PRO-002 | Sales Desk | Full desk: hot leads, follow-ups due, stale leads, quote follow-ups, recent calls |
| PRO-003 | Lead Detail | AI summary, next action, risk/priority scores (fit, engagement, urgency, value) |
| PRO-004 | Activity | Call outcome suggestions; meeting notes → decisions/tasks; voice-to-CRM |
| PRO-005 | Follow-up Engine | Auto tasks; smart reminder timing; draft email/WhatsApp/SMS — **approve to send** |
| PRO-006 | Communication | Objection-based draft follow-ups; tone selection |
| PRO-007 | Pipeline | AI stage suggestions; stuck-deal warnings; basic win probability; simple weighted forecast |
| PRO-008 | Data Hygiene | Missing fields, duplicate merge suggestions, dormant lead detection |
| PRO-009 | Manager Cockpit | Daily/weekly AI summary; team pipeline; stale report; exceptions |
| PRO-010 | Targets | Rep/month targets; achievement %; forecast vs target; plain-English pacing insight |
| PRO-011 | Quotations Lite | Quote + line items; AI draft description; statuses: draft/sent/accepted/rejected/expired; follow-up reminders |
| PRO-012 | Reporting | Conversion by source/stage; export CSV |
| PRO-013 | Admin | Users, teams, roles (Sales, Manager, Admin); limited custom fields; tenant branding |
| PRO-014 | Platform | Multi-tenant isolation; web + mobile; offline mobile (basic) |
| PRO-015 | Licensing | ScaleGate validate license; plan `pro`; seat limits; feature flags |

### 4.2 Explicitly not in Pro

Geofence/field attendance, ERP sync (beyond quotation data model ready), full email inbox sync, SSO/SAML, workflow builder, e-signature, advanced report builder, campaign ROI, post-sale account AI (→ Enterprise).

### 4.3 Web application layer (phased)

**Goal:** Browser app at **`app.wizcrm.app`** — **admin settings and manager workspace first**; mobile remains the primary rep experience in the field.

| Phase | Scope | Requirement IDs |
|-------|--------|-----------------|
| **1 — Admin console** | Auth, org/users/teams, AI/platform toggles, health | `INF-006`, `WEB-001`–`WEB-015`, `API-WEB-*` |
| **2 — Manager desk** | Pipeline board, team reports, CSV | `WEB-020`–`WEB-023`, `PRO-009`, `PRO-012` |
| **3 — Pro platform** | Multi-tenant, ScaleGate, branding | `PRO-014`, `PRO-015` |
| **4 — Sales parity** | Full CRM in browser (optional) | `WEB-030`–`WEB-033` |

Full detail, acceptance criteria, and architecture: **[SRS-WEB.md](./SRS-WEB.md)**.

**Lite note:** Web phase 1 does not change LITE-014 (mobile-first); it adds a **settings control plane** so API URL, desk mode, and users are not edited only via SSH.

---

## 5. WizCRM Enterprise (full CRM operating system)

**Goal:** Everything in **Pro** plus field intelligence, ERP/accounting sync, advanced integrations, and enterprise security.

### 5.1 Requirements (ENT-*)

| ID | Area | Requirement |
|----|------|-------------|
| ENT-001 | Field Sales | Meeting map pin, navigate, geofence arrival/departure, visit outcome prompt, voice visit report |
| ENT-002 | Field Analytics | Planned vs actual visits; short/no-show flags; manager exception report; optional arrival photo |
| ENT-003 | ERP Framework | Pluggable connectors: SAGE Evolution 200, SAP B1, QuickBooks, Tally |
| ENT-004 | ERP Customers | Bidirectional customer sync; field mapping; conflict policy; sync audit log |
| ENT-005 | ERP Quotations | Push quote to ERP; status pull; catalog/price lookup where available |
| ENT-006 | Integrations | Web lead forms, webhooks, calendar sync (Google/Microsoft), optional email sync |
| ENT-007 | Campaign ROI | Source quality, campaign ROI, spend recommendations |
| ENT-008 | Account Growth | Won → account; renewal/upsell AI; customer health score |
| ENT-009 | Pipeline Advanced | Deeper forecast, win/loss learning, territories, report builder |
| ENT-010 | Security | SSO/SAML, 2FA, IP allowlist, retention, optional field encryption |
| ENT-011 | Platform | ScaleGate plan `enterprise`; usage metering hooks; compliance tooling |
| ENT-012 | Optional roadmap | E-sign, Slack/Teams, gamification — per commercial priority |

Reference: ERP detail in git SRS v1.1 §15 (FR-ERP-*) remains valid for Enterprise implementation.

---

## 6. Lead lifecycle (domain)

Stages and activity types remain as defined in **[LEAD_LIFECYCLE.md](./LEAD_LIFECYCLE.md)**. In v2:

- Stage changes are **AI-suggested** with user approval (Lite/Pro default).
- Timeline includes **AI-generated summaries** alongside human and system events.
- Won/Lost still require outcome/reason capture (AI may pre-fill from conversation).

---

## 7. Non-functional requirements (NFR-*)

| ID | Requirement | Lite | Pro | Enterprise |
|----|-------------|:----:|:---:|:----------:|
| NFR-001 | HTTPS / secure API | ● | ● | ● |
| NFR-002 | Tenant data isolation | — | ● | ● |
| NFR-003 | AI audit log (suggest/approve) | ● | ● | ● |
| NFR-004 | Graceful AI degradation | ● | ● | ● |
| NFR-005 | POPIA/GDPR export-delete | — | ● | ● |
| NFR-006 | p95 list load &lt; 2 s (10k leads/tenant) | — | ● | ● |
| NFR-007 | Observability (errors, LLM latency) | ● | ● | ● |
| NFR-008 | i18n-ready strings | ● | ● | ● |

---

## 8. ScaleGate licensing (Pro + Enterprise)

| ID | Requirement |
|----|-------------|
| SG-001 | ScaleGate is system of record for subscriptions |
| SG-002 | Plans: `lite` (internal), `pro`, `enterprise` with feature flags per §2 |
| SG-003 | Validate on login and periodic job; grace + read-only mode |
| SG-004 | Seat enforcement on user invite (Pro/Enterprise) |
| SG-005 | `LICENSE_DEV_MODE` for local development |

Lite internal pilot may omit ScaleGate integration (INF flag).

---

## 9. Technical add-ons (TOOL-*)

| ID | Component | Lite | Pro | Enterprise |
|----|-----------|:----:|:---:|:----------:|
| TOOL-001 | LLM / AI orchestration service | ● | ● | ● |
| TOOL-002 | Card scan (camera + OCR/vision API) | ● | ● | ● |
| TOOL-003 | `expo-secure-store` | ● | ● | ● |
| TOOL-004 | Call detection (Android) | ● | ● | ● |
| TOOL-005 | `expo-notifications` + FCM/APNs | — | ● | ● |
| TOOL-006 | ScaleGate HTTP client | — | ● | ● |
| TOOL-007 | `expo-location` + geofence | — | — | ● |
| TOOL-008 | Maps / Geocoding | — | — | ● |
| TOOL-009 | `integrations/erp/*` | — | stub | ● |
| TOOL-010 | EAS production builds | — | ● | ● |

Manager prerequisites: [manager_tasks.md](./manager_tasks.md).

---

## 10. Delivery roadmap

| Phase | Tier | Target | Tracker prefix |
|-------|------|--------|----------------|
| 1 | **Lite** | ~1 week | `LITE-*`, `UT-*`, `QA-*`, `E2E-*`, `INF-*`, `TOOL-*` (subset) |
| 2 | **Pro** | ~1 month | `PRO-*`, `UT-PRO-*`, `QA-PRO-*`, `SG-*`, multi-tenant |
| 3 | **Enterprise** | Ongoing | `ENT-*`, `UT-ENT-*`, `QA-ENT-*`, ERP, geofence |

---

## 11. Task IDs, quality assurance, and testing

All delivery work is tracked by **Task ID** in [PROGRESS_TRACKER.md](./PROGRESS_TRACKER.md). Use IDs in commits, PRs, and discussions (e.g. “`UT-LITE-002` is failing”).

### 11.1 Task ID prefixes

| Prefix | Meaning | Example |
|--------|---------|---------|
| `INF-*` | Infrastructure / platform | `INF-004` backend API |
| `LITE-*` / `PRO-*` / `ENT-*` | Product requirement (this SRS) | `LITE-001` Lead Inbox |
| `UT-*` | **Unit / automated tests** for a requirement | `UT-LITE-001` tests for `LITE-001` |
| `QA-*` | **Manual acceptance / QA** checklist | `QA-LITE-001` verifies SRS acceptance |
| `E2E-*` | **End-to-end** tests (mobile or API journey) | `E2E-LITE-LOGIN` |
| `TOOL-*` | Packages and external services | `TOOL-002` card scan |
| `NFR-*` | Non-functional requirements | `NFR-004` AI degradation |
| `MGT-*` | Manager / non-technical ([manager_tasks.md](./manager_tasks.md)) | `MGT-011` ERP sandbox |

**Naming:** `UT-LITE-001` pairs with `LITE-001`. Same pattern for Pro and Enterprise when that tier starts.

### 11.2 Definition of done (per feature)

A requirement **`LITE-*`** (or `PRO-*` / `ENT-*`) is **Done** only when:

1. Implementation merged on `development`.
2. Paired **`UT-*`** exists, runs in CI or documented local command, and **passes**.
3. Paired **`QA-*`** executed and marked pass (or waived in tracker with reason).
4. **`E2E-*`** pass where listed for that feature (Lite: critical journeys only).

### 11.3 Unit testing policy

| Layer | Tooling (target) | What to unit-test |
|-------|------------------|-------------------|
| **API / domain** | Jest or Vitest + test DB or in-memory | Validation, duplicate rules, stage rules, desk ranking, auth, AI fallback paths |
| **Shared** | Same runner | Types, pure helpers, stage enums, phone/email normalizers |
| **Mobile** | Jest + React Native Testing Library | Form validation, API client mappers, reducers/hooks, desk list logic |
| **AI orchestration** | Mocked LLM | Prompt builders, parse responses, audit log writes, degrade-to-manual |

Unit tests run **at every critical point**: when a module is introduced or changed, add or update the matching `UT-*` in the same PR.

**Critical points for Lite (minimum `UT-*` set):** auth, lead create/validation, duplicate detection, stage transitions, timeline ordering, task due logic, Sales Desk rules, AI summary/next-action with mock LLM, card-parse mapper, post-call payload builder.

### 11.4 QA and acceptance testing

`QA-*` tasks are **human or scripted acceptance** checks tied to SRS acceptance columns—not optional polish.

| ID | Scope |
|----|--------|
| `QA-LITE-PILOT` | Full internal pilot script: add/scan lead → desk → log call → read summary → pipeline view |
| `QA-LITE-ANDROID` | Android emulator/device smoke on each release candidate |
| `QA-LITE-001` … `QA-LITE-014` | One QA task per `LITE-*` requirement (see tracker) |
| `QA-PRO-PILOT` / `QA-ENT-PILOT` | Tier sign-off when Pro / Enterprise starts |

### 11.5 End-to-end testing (Lite)

| ID | Journey |
|----|---------|
| `E2E-LITE-LOGIN` | Login → token stored → authorized API calls |
| `E2E-LITE-LEAD` | Create lead → appears in list and pipeline |
| `E2E-LITE-TIMELINE` | Add note → visible on timeline in order |
| `E2E-LITE-DESK` | Desk shows due follow-up after task created |
| `E2E-LITE-CARD` | Card photo → prefill → save lead (mock or real vision API) |
| `E2E-LITE-POSTCALL` | Post-call flow on Android emulator |

E2E may use Detox, Maestro, or API-level supertest plus mobile smoke—chosen at `INF-009` setup.

### 11.6 Test infrastructure (`INF-*`)

| ID | Requirement |
|----|-------------|
| INF-009 | Test runners configured: API (`npm test`), mobile (`npm test` in `mobile/`), shared package |
| INF-010 | CI or pre-push script runs `UT-*` for touched packages (full CI at `INF-007` for Pro) |

---

## 12. Traceability

| Document | Purpose |
|----------|---------|
| [PROGRESS_TRACKER.md](./PROGRESS_TRACKER.md) | Status: `LITE-*` / `PRO-*` / `ENT-*`, `UT-*`, `QA-*`, `E2E-*` |
| [WizCRM Features.md](./WizCRM%20Features.md) | Brochure / sales feature lists by tier |
| SRS Appendix A | Deferred backlog (`FR-NTH-*`, non-MVP) |
| [manager_task_tracker.md](./manager_task_tracker.md) | Non-technical tasks (`MGT-*`) |
| [MOBILE_DEV.md](./MOBILE_DEV.md) | Android / Expo toolchain |

---

## Appendix A — Deferred / nice-to-have (`FR-NTH-*`)

**Status:** Not required for **Lite**, **Pro**, or **Enterprise** MVP. Kept for backlog prioritization after tier delivery.

**Promoted to core in SRS v2.0** (do not plan as `FR-NTH-*`; use tier IDs instead):

| FR-NTH-* | Now covered by |
|----------|----------------|
| FR-NTH-023 | Business card scan → `LITE-003` |
| FR-NTH-040 | Timeline / lead summary → `LITE-006`, `PRO-003` |
| FR-NTH-041 | Next action → `LITE-007`, `PRO-003` |
| FR-NTH-044 | Voice note → activity → `LITE-008`, `PRO-004` |
| FR-NTH-072 | Quotas / goals → `PRO-010` |
| FR-NTH-073 | Weighted forecast (basic) → `PRO-007` |
| FR-NTH-084 | Arrival photo (optional) → `ENT-002` |
| FR-NTH-090–092 | SSO, 2FA, IP allowlist → `ENT-010` |
| FR-NTH-022 | E-signature → `ENT-012` (optional roadmap) |

All other rows below remain **deferred** unless a future SRS revision promotes them.

### A.1 UX and personalization

| ID | Feature | Description | Acceptance hint |
|----|---------|-------------|-----------------|
| FR-NTH-001 | Dark / light theme | User or system setting; persist per device. | All main screens respect theme. |
| FR-NTH-002 | Customizable home | User orders widgets: tasks, pipeline, stale. | Drag reorder saved. |
| FR-NTH-003 | Pinned leads | Quick access list. | Pin/unpin from detail. |
| FR-NTH-004 | Recent searches | Last 10 searches. | Tap to re-run. |
| FR-NTH-005 | Haptic feedback | On stage change, task complete. | Toggle in settings. |
| FR-NTH-006 | Accessibility | Dynamic type, screen reader labels, contrast. | WCAG 2.1 AA target on web. |

### A.2 Collaboration

| ID | Feature | Description |
|----|---------|-------------|
| FR-NTH-010 | @mention in notes | Notify user; deep link to lead. |
| FR-NTH-011 | Lead thread chat | Internal messages per lead, not SMS to customer. |
| FR-NTH-012 | Handoff checklist | Template when reassigning owner. |
| FR-NTH-013 | Shared team views | Manager publishes filter to team. |
| FR-NTH-014 | Activity feed | Global “team updates” stream. |

### A.3 Documents

| ID | Feature | Description |
|----|---------|-------------|
| FR-NTH-020 | File attachments | PDF/images on lead; size limits. |
| FR-NTH-021 | Document templates | Merge fields from lead. |
| FR-NTH-022 | E-signature integration | DocuSign / similar webhook. *(See `ENT-012`.)* |

### A.4 Communication

| ID | Feature | Description |
|----|---------|-------------|
| FR-NTH-030 | Email templates | Variables: `{{name}}`, `{{company}}`. |
| FR-NTH-031 | SMS / WhatsApp log | Manual log or API integration. |
| FR-NTH-032 | Voicemail link | URL in call activity. |

### A.5 Intelligence (AI) — deferred only

| ID | Feature | Description |
|----|---------|-------------|
| FR-NTH-042 | Lead scoring | 0–100; configurable weights. *(Pro has priority scores in `PRO-003`.)* |
| FR-NTH-043 | Sentiment on notes | Optional tag positive/negative/neutral. |

### A.6 Productivity

| ID | Feature | Description |
|----|---------|-------------|
| FR-NTH-050 | Snooze lead | Hide until datetime. |
| FR-NTH-051 | Web keyboard shortcuts | j/k navigate, / search. |
| FR-NTH-052 | Calendar week view | Meetings + tasks. |
| FR-NTH-053 | Working hours DND | Suppress non-urgent push outside hours. |

### A.7 Integrations (extended)

| ID | Feature | Description |
|----|---------|-------------|
| FR-NTH-060 | Contact sync | Device contacts ↔ leads (opt-in). |
| FR-NTH-061 | Accounting export | Manual export when ERP connector not enabled. |
| FR-NTH-062 | Marketing handoff | Webhook to HubSpot-style systems. |

### A.8 Reporting (extended)

| ID | Feature | Description |
|----|---------|-------------|
| FR-NTH-070 | Report builder | User-defined columns and charts. *(Enterprise: `ENT-009`.)* |
| FR-NTH-071 | Scheduled email reports | Cron weekly PDF/CSV. |

### A.9 Mobile extended

| ID | Feature | Description |
|----|---------|-------------|
| FR-NTH-080 | Home screen widget | Tasks due today. |
| FR-NTH-081 | Wear OS / Watch | Next task glance. |
| FR-NTH-082 | Share lead PDF | Internal summary export. |
| FR-NTH-083 | Driving mode | Voice-only logging; minimal UI. |

### A.10 Enterprise and trust — deferred only

| ID | Feature | Description |
|----|---------|-------------|
| FR-NTH-093 | Data retention job | Auto-archive leads older than N years. |
| FR-NTH-094 | Encrypt sensitive notes | Field-level at rest. *(Enterprise: `ENT-010` optional field encryption.)* |

### A.11 Gamification

| ID | Feature | Description |
|----|---------|-------------|
| FR-NTH-100 | Leaderboard | Calls logged, meetings attended, deals won. |
| FR-NTH-101 | Badges | Milestones; opt-out for org. |

### A.12 Geofence extensions

| ID | Feature | Description |
|----|---------|-------------|
| FR-NTH-110 | Map draw geofence (web) | Circle editor when creating meeting. |
| FR-NTH-111 | Visitor log export | Compliance PDF per meeting. |

**Source:** SRS v1.2 §17; reproduced in v2.0 for backlog traceability.

---

## 13. Document history

| Version | Date | Changes |
|---------|------|---------|
| 1.0–1.2 | 2026-05-17 | User-driven CRM; geofence; ScaleGate; ERP; manager tasks |
| 2.0 | 2026-05-17 | AI-first product; tiers **Lite** / **Pro** / **Enterprise** |
| 2.1 | 2026-05-17 | Appendix A: deferred `FR-NTH-*` backlog (Option A) |
| 2.2 | 2026-05-17 | Task IDs; `UT-*` / `QA-*` / `E2E-*`; unit testing and QA policy |
