# WizCRM — Feature Guide

**WizCRM is an AI-first CRM built for African SME field-sales teams.** It pairs a manager/admin web console with a rep-first native mobile app, and threads AI through the parts of selling that reps hate doing — writing up visits, chasing leads, and keeping the pipeline honest. The headline promise: **a CRM that writes itself.**

> **Scope of this document.** This is a functional feature reference for the product as it exists in the codebase today (`api` · `web` · `mobile` · `shared`). Where a capability is AI/LLM-powered vs. rules-based, it says so — the distinction is a selling point, not a caveat. Kenya/African-market specifics (KDPA compliance, Nairobi discovery, local tender feeds) are called out where relevant.

---

## Contents

1. [Overview & platform shape](#1-overview--platform-shape)
2. [🤖 The AI & Intelligence Layer](#2--the-ai--intelligence-layer) ← the highlight
3. [Lead & pipeline management](#3-lead--pipeline-management)
4. [Field sales — the mobile app](#4-field-sales--the-mobile-app)
5. [Activities, visits & team collaboration](#5-activities-visits--team-collaboration)
6. [Calendar & field attendance](#6-calendar--field-attendance)
7. [Sales execution — opportunities, quotations & ERP](#7-sales-execution--opportunities-quotations--erp)
8. [Lead Engine — AI-assisted outbound prospecting](#8-lead-engine--ai-assisted-outbound-prospecting)
9. [Reports & analytics](#9-reports--analytics)
10. [Document library](#10-document-library)
11. [Teams, users & organization](#11-teams-users--organization)
12. [Admin, settings & white-labeling](#12-admin-settings--white-labeling)
13. [Integrations](#13-integrations)
14. [Security, privacy & KDPA compliance](#14-security-privacy--kdpa-compliance)
15. [Plans & entitlements](#15-plans--entitlements)
16. [Platform & architecture](#16-platform--architecture)
- [Appendix A — Data model](#appendix-a--data-model)
- [Appendix B — AI feature → model map](#appendix-b--ai-feature--model-map)

---

## 1. Overview & platform shape

WizCRM ships as three coordinated surfaces over one API:

| Surface | Who uses it | What it's for |
|---|---|---|
| **Web console** (React) | Managers & admins | Oversight, analytics, pipeline design, prospecting campaigns, org/user/branding setup |
| **Mobile app** (native Android, React Native/Expo) | Field reps (full read/write); managers (oversight) | The rep's daily driver — visits, calls, notes, leads, documents, check-ins, offline |
| **API** (Fastify + Prisma/PostgreSQL) | — | Shared brain: auth, business rules, AI orchestration, integrations |

**Two personas, two front doors.** Reps live in the mobile app and do the selling; managers live in the web console and run the team. Managers have **read-only lead access on mobile** by design — their mobile value is oversight (teams, metrics, attendance, reassignment), while deep editing happens on the web.

**Built for the field.** Everything the rep does — capturing a visit, logging a call, saving a note, adding a task — **works offline** and syncs when a connection returns. The app is explicitly built for reps on Kenyan roads with patchy data.

---

## 2. 🤖 The AI & Intelligence Layer

This is what sets WizCRM apart. AI is not a bolt-on chatbot — it's woven into the daily motions of field selling. Every AI feature follows three rules:

- **AI drafts, humans decide.** Nothing is written to a lead without the rep's explicit confirmation. AI proposes; the rep approves, edits, or dismisses.
- **Everything is audited.** Every AI call is logged (feature, model, input/output summary, approved-or-not) to an immutable audit trail.
- **It degrades gracefully.** If AI is unconfigured or the device is offline, every feature falls back to manual entry or deterministic rules — the app never breaks because AI is unavailable.

**Under the hood:** all generative AI runs **server-side through OpenAI** — `gpt-4o-mini` for text and vision (JSON-mode, low temperature for consistency), and `whisper-1` for speech-to-text. The model is configurable. No customer data is sent to the client for AI; the mobile app only records audio/photos and renders the drafted result.

### 2.1 ⭐ Flagship: AI Visit Capture — "the CRM that writes itself"

The signature feature. A rep finishes a customer visit, taps one button, and **talks for 20–30 seconds** about what happened. WizCRM does the paperwork.

**How it works, end to end:**

1. **Speak.** On the Visit Report screen the rep taps **🎙 "Start speaking"** and describes the visit in their own words ("Met the ops manager, they're interested but worried about price, competitor is X, wants a quote by Thursday").
2. **Transcribe.** The audio is transcribed by Whisper.
3. **Structure.** `gpt-4o-mini` reads the transcript **plus the lead's context** (name, company, current stage, recent activity, open tasks) and drafts a fully structured visit report:
   - **Outcome** (e.g. "Interested", "Requested quote", "Not now")
   - **Who they met**, **competitor named**, **objection raised**
   - **Next step** — a concrete follow-up action
   - **Suggested due date** — resolved to a real date ("Thursday" → an actual ISO date relative to today)
   - **Clean 1–3 sentence CRM summary**
   - **Suggested pipeline stage** — *only* if the visit clearly advances the deal
4. **Review & save.** Every field is pre-filled but **fully editable**, and the AI never overwrites anything the rep already typed. The rep glances over it, tweaks if needed, and saves. The save itself is a normal (non-AI) write and **works offline**.

**Guardrails that matter:** the prompt is explicitly instructed to *use only facts stated in the note, never invent names/competitors/commitments, and put null for anything not mentioned.* The suggested stage is discarded unless it's a legal pipeline transition. The rep opts in to any stage change via a checkbox.

**Why it's a big deal:** field reps notoriously skip CRM data entry. WizCRM turns a 5-minute typing chore into a 20-second voice note — so the CRM actually gets filled in, and managers get real field intelligence instead of blank records.

### 2.2 Generative AI features (LLM-powered)

Beyond visit capture, `gpt-4o-mini`/Whisper power a suite of "draft-and-approve" assists:

| Feature | What the rep/manager gets | Where |
|---|---|---|
| **Business-card scan** | Photograph a business card → AI vision reads it and auto-fills name, company, email(s), phone(s), address on the new-lead form | Mobile (new lead) |
| **Log call (AI post-call)** | Type/paste a rough call note → AI returns a clean summary + a suggested follow-up task + a suggested stage; rep confirms | Mobile & web |
| **Voice-to-text notes** | Dictate a note → transcribed and optionally cleaned into a professional CRM note | Mobile |
| **Lead summary** | A 2–4 sentence plain-language "where this deal stands" on demand | Mobile & web lead view |
| **Suggested next action** | AI recommends the single best next move with a reason → one tap to create the task, or dismiss (dismissals are remembered) | Mobile & web |
| **Stage suggestion** | A guarded recommendation to advance the pipeline stage, with provenance recorded | Mobile & web |
| **Sales Desk (AI-ranked)** | An optional AI ranking of "what to do today" across the rep's book (off by default; deterministic rules otherwise) | Mobile & web |
| **Smart lead capture** | On a new lead, AI suggests the likely source and priority (HOT/WARM/COLD) — with a rules-based fallback | Web/mobile (Pro) |
| **Manager brief** | The morning brief bullets can be topped with a one-paragraph AI summary | Web dashboard (Pro) |

Every one of these is **approve-before-write** and **audited**.

### 2.3 Automated discovery & explainable scoring

A second family of "intelligence" is **deterministic and rules-based** — which is deliberate. Unlike a black-box model, these scores are **transparent, tunable, and explainable**: a rep can see exactly *why* a company scored what it did, and a manager can re-tune the rules per campaign.

- **ICP prospect scoring** (Lead Engine, §8) — grades each discovered company 0–85 on fit + firmographics + reputation, drops the junk, and sorts survivors into **A / B / C tiers**. Every prospect carries a per-signal score breakdown.
- **Lead insights** — computes **engagement / urgency / fit** scores (0–100) plus data-hygiene flags from lead activity, priority, and completeness.
- **Weighted pipeline forecast** — probability-weighted expected revenue across open opportunities and late-stage leads.
- **Heat Map intent scoring** (§8) — grades live buying-intent signals (tenders, "looking for a supplier" posts, hiring sprees) **HOT / WARM / MEDIUM** using keyword heuristics over web-search and registry data.

One genuinely AI-backed step lives inside the Lead Engine: **Firecrawl website enrichment** uses LLM extraction to read a prospect's website and pull out company description, employee band, sector, and — critically for an ERP vendor — **whether they already run accounting/ERP software** (a buying signal).

### 2.4 AI governance, trust & safety

A real differentiator, especially for regulated/enterprise buyers:

- **Full AI audit log** — every AI invocation is recorded (org, user, feature, model, prompt version, truncated input/output, approval flag) and viewable by admins. Nothing the AI does is invisible.
- **Human-in-the-loop by construction** — AI writes *suggestions*, not records. Stage changes even track whether they were AI-suggested vs. human-initiated.
- **Graceful degradation** — no OpenAI key? AI endpoints return a clean "unavailable" and the UI falls back to manual/rules. The product is fully usable with AI turned off.
- **KDPA-aware** — AI-driven prospecting respects Kenya's Data Protection Act at the data layer (§14).

### 2.5 AI at a glance

| Capability | Powered by | Runs |
|---|---|---|
| Speech-to-text (visit capture, voice notes) | OpenAI **Whisper** (`whisper-1`) | Server-side |
| Report drafting, summaries, next-action, post-call, card OCR | OpenAI **`gpt-4o-mini`** (text + vision, configurable) | Server-side |
| Website enrichment / contact extraction | **Firecrawl** (LLM extraction) | Third-party API |
| ICP scoring, lead insights, forecast, heat-map ranking | **Explainable rules** (in-house) | Server-side |

> **Note on current AI status:** Communication drafts (email/WhatsApp) are currently **template-based**, with LLM generation on the roadmap. The Sales Desk AI ranking is **opt-in** (rules-based by default). See [Appendix B](#appendix-b--ai-feature--model-map) for the exact feature→model mapping.

---

## 3. Lead & pipeline management

The core CRM. A **Lead** is the central object — a person/company moving through a sales pipeline.

**Pipeline stages:** `NEW → CONTACTED → QUALIFIED → PROPOSAL → NEGOTIATION → WON / LOST`. Stages are **fully customizable per organization** (rename, reorder, add/remove — with at least one open stage enforced).

**Lead capabilities:**
- **Create** with duplicate detection — email/phone are normalized and checked before save; the rep gets a "create anyway" override if it's a genuine new lead. (A database advisory lock closes the race where two people create the same lead at once.)
- **Kanban pipeline** — drag cards between stages *and* reorder within a stage, with optimistic updates. Stage transitions are rule-enforced (e.g. WON requires a deal value; LOST requires a structured loss reason).
- **List view** — search across name/company/email/phone/owner/team/tags, filter by stage/tag/team, sortable columns.
- **Lead detail** — the object hub: contact info, tags, owner, stage, full activity timeline, tasks, opportunities, quotations, team chat, attachments, and AI panels.
- **Close outcomes** — Won captures deal value, start date, and products/services; Lost captures a structured loss reason (from a configurable list). Closed leads can be **reopened**.
- **Ownership & assignment** — managers reassign owners individually or in **bulk**; non-managers only ever see their own leads.
- **Bulk operations** — multi-select to bulk-change stage or reassign owner.
- **CSV bulk import** — paste or upload up to 500 rows with a preview, header auto-detection, default-owner assignment, and per-row dedup + error reporting.
- **Priority** — HOT / WARM / COLD flags.
- **Stale-lead detection** — leads with no activity beyond an org-configurable threshold surface across insights, the desk, and reports.

---

## 4. Field sales — the mobile app

The native Android app is the rep's field tool. Beyond everything in §3 (leads, pipeline, activities), it adds device-native capabilities:

- **One-tap communications** — Call (`tel:`), WhatsApp (native → web fallback), and Open-in-Google-Maps straight from the lead.
- **Business-card scanning** — camera/gallery → AI vision → auto-filled lead (§2.2).
- **AI Visit Capture** — the flagship voice-to-report flow (§2.1).
- **Voice notes** — dictate notes; attach voice memos to visits.
- **Photo attachments** — attach compressed site/product photos to visits and leads.
- **GPS & geofenced check-in** — attach location + timestamp to visits; check in/out of meetings within a geofence (§6).
- **Document library on the go** — download catalogs/brochures and **share them to a customer over WhatsApp** from the field (§10).
- **Offline-first** — a unified offline queue holds notes, activities, lead edits, tasks, visit reports, and attachments (as base64) and replays them on reconnect; leads and documents are cached for offline reading with clear "showing cached" banners.
- **Local reminders & notifications** — device notifications for tasks due today, meeting reminders, and custom reminders (two Android channels, high priority).
- **Post-call prompt** — after a phone call, the app offers to log it via the AI post-call flow.
- **Secure sessions** — JWT stored in the device secure store; session restored on launch.
- **Field-flexible API config** — reps can point the app at the right server by pasting a URL or importing a config file (built for pilots where the API address varies).

---

## 5. Activities, visits & team collaboration

**Activity timeline** — every lead has a chronological log: calls, emails, meetings, notes, stage changes, opportunities, and calendar events. Notes can be run through the AI cleaner.

**Structured visit reports** — a first-class field-visit record (outcome, who-met, competitor, objection, next step, optional GPS) that automatically creates a follow-up task from the "next step." This is what AI Visit Capture drafts.

**Internal team chat per lead** — a private, per-lead thread for the sales team (explicitly *not* customer messaging). Supports **@mentions** (with autocomplete), and mentioning a teammate emails them a deep link. Supports **file attachments** (up to 5 MB), with downloads forced as attachments and content-type hardened against stored-XSS.

**Tasks** — lightweight to-dos, optionally attached to a lead, with due dates, tags, and completion. They drive reminders and the "due today" desk.

---

## 6. Calendar & field attendance

- **Calendar** — day/week/month views; create/edit/delete events with title, times, all-day, notes, tags, reminders, and a **meeting location** (address + coordinates, with "Open in Google Maps").
- **Recurrence** — none/daily/weekly/monthly/custom-interval.
- **Geofenced check-in / check-out** — reps check into a meeting only when physically within the org's configured radius (Haversine distance). Outside the fence, reps are blocked while **managers can override**. The system auto-derives **on-time vs. late** (with a grace window) and records check-in distance.
- **Attendance report** (managers) — meetings with check-in/out status, on-time/late/no-show counts, geofence overrides, and missing check-ins — real accountability for a distributed field team.
- **Personal reminders** — standalone reminders with time, notes, tags, and optional lead/event links, scheduled as local device notifications.

---

## 7. Sales execution — opportunities, quotations & ERP

**Sales opportunities** — formal deals attached to a lead, with auto-generated reference numbers, stage/status, **probability %**, budgeted vs. forecast values, and a computed **expected value** (forecast × probability). Closing locks the record.

**Quotations** *(Pro)* — line-item quotes with server-computed subtotal/tax/total, auto reference numbers (`Q-YYYY-NNNN`), and a `DRAFT → SENT → ACCEPTED/REJECTED/EXPIRED` lifecycle. Sending a quote auto-sets a **follow-up date** that surfaces on the Sales Desk so nothing is forgotten.

**ERP sync** *(Pro)* — push accepted/sent quotations to an ERP with sync-status tracking and an audit log. *Current state: a stub connector that marks records synced and logs the attempt; real connectors (Sage/SAP B1/QuickBooks) are scaffolded but not yet wired.* The data model and UI are ready for a live connector.

---

## 8. Lead Engine — AI-assisted outbound prospecting

WizCRM's biggest subsystem: **describe your ideal customer, and the engine finds, scores, enriches, and de-dupes matching companies — then hands reps a ranked list of prospects and their decision-makers.** Built for the Kenyan market and KDPA-compliant end to end.

### Campaigns
Define a campaign with **industry keywords**, **target locations**, a **company-size band**, and a **scoring-rules** model. Track prospects, emails sent, and replies per campaign. Status: `DRAFT / ACTIVE / PAUSED / CLOSED`.

### ICP discovery pipeline ("Run ICP")
A one-click waterfall that runs per candidate company:

1. **Discover** — Google-Maps company discovery via **Apify** (Kenya-scoped), returning name, website, phone, address, coordinates, categories, and Google **rating + review count**.
2. **Suppress** — skip anything on the org's do-not-contact list.
3. **Score** — cheap firmographic scoring *before* any expensive work; sub-tier firms are dropped immediately.
4. **De-dupe** — skip companies already in your CRM.
5. **Enrich** — read the survivor's website via **Firecrawl** LLM extraction (description, employee band, sector, **existing-ERP detection**).
6. **Find contacts** — decision-maker lookup via **Apollo**, filtered to buying-relevant titles (procurement, ops, finance, IT/ERP, MD/CEO).
7. **Persist** — save the prospect with its score, tier, breakdown, enrichment, and KDPA-gated contacts.

An alternate **"Run Discovery"** path uses the Google Places API directly as a background job you can poll.

### Explainable scoring & tiers
Each candidate is graded on a transparent, per-campaign-editable rule set (default max **85 points**):

| Signal | Points | Meaning |
|---|---|---|
| Industry keyword match | 30 | Name/sector matches your target industry (the dominant signal) |
| Has website | 15 | A real web presence |
| Strong reputation | 15 | Google rating ≥ 4.0 **and** ≥ 20 reviews |
| Established | 10 | ≥ 50 reviews |
| Has phone | 10 | Contactable |
| Has any rating | 5 | Present on Google |

Scores map to tiers **A ≥ 60 · B ≥ 35 · C ≥ 15**; anything below 15 is dropped before a rep ever sees it. Every prospect stores a **score breakdown** so the grade is fully explainable. The graded design deliberately prevents any single signal from dominating, so prospects spread across tiers instead of all collapsing into one.

### Contact Finder
A standalone tool: paste up to 50 company names and get decision-maker contacts via a **provider waterfall — Apollo → Hunter → Prospeo → Tomba → Firecrawl** — stopping once enough named contacts are found. Results are **cached 30 days per org** (so re-queries cost no API credits), KDPA-classified, and CSV-exportable.

### Heat Map — buyer-intent radar
A live map/feed of companies showing **intent to buy right now**, scanned across **9 sources in parallel**:
- **Tavily** AI web search (RFQ/tender/"looking for a supplier"/"switching from Excel" queries, heavily noise-filtered)
- **Hiring signals** (companies hiring finance/HR/IT = scaling = ERP buyers)
- **LinkedIn** buyer posts, **new-business** registrations
- **OpenCorporates** & registry lookups (newly incorporated Kenyan companies)
- **Government tenders** — PPRA & TendersKenya
- **Reddit** (r/Kenya) & **Google Custom Search** forums

Signals are graded **HOT / WARM / MEDIUM**, plotted on an **interactive SVG map of Kenya**, filterable, CSV-exportable, and each carries a one-tap **"Get contact"** (on-demand Apollo lookup). A weekly scheduler auto-scans active campaigns every Monday morning (Nairobi time).

### Email outreach & sequences
Build reusable **email templates** with merge fields (`{{company_name}}` etc.), assemble a multi-step **drip sequence** (e.g. Day 0 / 5 / 10, "stops on reply"), and send via **Brevo**. Every send appends an HMAC-signed one-click unsubscribe footer and is tracked (sent/opened/clicked/replied/failed) via Brevo webhooks. **A reply auto-imports the prospect into your CRM pipeline**; an unsubscribe or hard bounce auto-suppresses the contact.

### Prospect management
Paginated, filterable prospect lists (tier/status/search); per-prospect drawer showing the score breakdown, enrichment, and contacts; and **one-click import** (single or bulk) into the CRM pipeline with tier tags carried across.

---

## 9. Reports & analytics

Manager-facing executive analytics (some **Pro**-gated):

- **Executive dashboard** — role-adaptive KPIs (open, won, stale, overdue, win rate, total), sparklines, trend badges, and **click-to-drill-down** into the underlying leads/tasks.
- **Pipeline & funnel** — stage mix, conversion funnel (with % of cohort and step-over-step conversion), and **average time-in-stage** derived from real stage-change history.
- **Source & win/loss analysis** — performance by lead source, win/loss breakdown, and structured **loss-reason** analysis.
- **Rep performance & workload** — per-rep leaderboard and live team workload.
- **Weighted pipeline forecast** *(Pro)* — probability-weighted expected revenue.
- **Targets & pacing** *(Pro)* — monthly revenue targets vs. actuals, per rep and org-wide, with "ahead / on track / behind" labels.
- **Data hygiene report** *(Pro)* — missing contacts/companies, stale leads, uncontacted new leads, overdue tasks, and duplicate groups, with the worst-offender leads linked.
- **Manager morning brief** *(Pro)* — a bulleted daily brief (open/stale/overdue, pacing, hygiene, due quotes) with an optional AI summary paragraph.
- **CSV export** — lead exports are CSV-injection-safe.

---

## 10. Document library

An org-wide library of sales collateral — catalogs, brochures, price lists, spec sheets — that **reps carry in their pocket**.

- Managers **upload** (up to 25 MB) with a title, category, and product tags; **version**, **activate/deactivate**, and **remove**.
- Everyone can **search** and filter by category/tags.
- On mobile, tapping a document downloads it (authenticated) and opens the OS share sheet — so a rep can preview it or **send it straight to a customer on WhatsApp**. Documents are cached for **offline** access.

---

## 11. Teams, users & organization

- **Teams** — create teams, assign sales reps, and see rolled-up team stats (open/stale/won leads, overdue tasks, last activity).
- **Team drill-downs** — per-team and per-rep metric lists, and a merged **team activity feed** across a date range.
- **Users** *(Admin)* — create and manage users with roles **SALES / MANAGER / ADMIN**; password strength is enforced (zxcvbn).
- **Organization** — org display name and settings.
- **Role model** — reps see only their own leads; managers see the team; admins configure the org.

---

## 12. Admin, settings & white-labeling

- **CRM lists & thresholds** — configurable lead sources, suggested tags, structured loss reasons, stale-lead threshold, geofence radius, meeting grace minutes, and quote follow-up default.
- **Branding / white-labeling** — org display name, logo, **accent color**, and support email, applied live across the app (the sidebar re-themes at runtime).
- **AI & platform settings** — OpenAI key/model status, the **commercial plan** selector (lite/pro/enterprise unlocks Pro modules), and the Sales Desk AI-vs-rules toggle.
- **Data Sources / Lead Engine settings** — per-provider enable/disable toggles for every discovery/enrichment/contact provider (a provider only activates when its server-side API key is present; keys are **never** stored in the database), plus a global cap on companies per ICP run.
- **Mobile connection** — shows the API URL for the phone app with copy-to-clipboard.
- **Integrations** — webhook lead-capture setup (generate/rotate secret, copy endpoint) and ERP connector status.
- **AI audit log** — a read-only view of recent AI operations for oversight.

---

## 13. Integrations

| Integration | Purpose |
|---|---|
| **OpenAI** (`gpt-4o-mini`, `whisper-1`, vision) | All generative AI: visit capture, summaries, next-action, post-call, card OCR, transcription |
| **Brevo** (API + SMTP fallback) | Transactional email, campaign/sequence sends, and inbound engagement webhooks (open/click/reply/bounce/unsubscribe) |
| **Apify** | Google-Maps company discovery (ICP pipeline) |
| **Google Places** | Company discovery (alternate path) |
| **Firecrawl** | LLM website enrichment + contact scraping |
| **Apollo / Hunter / Prospeo / Tomba** | Decision-maker contact discovery (waterfall) |
| **Tavily** | AI web search for buyer-intent signals |
| **OpenCorporates / Registry Lookup** | New-company registry signals |
| **Google Custom Search / Reddit** | Forum & community intent signals |
| **PPRA / TendersKenya** | Kenyan government tender signals |
| **Inbound lead webhook** | Push leads in from external forms/automation (per-org secret) |
| **ERP** | Quotation push — *stub connector today; Sage/SAP B1/QuickBooks scaffolded* |

**File storage** is on local disk (not cloud object storage) today. **Mobile push** goes through Expo's notification service (local scheduling).

---

## 14. Security, privacy & KDPA compliance

Security is treated as a first-class feature, with a Kenya-specific privacy story.

**Auth & access:**
- **JWT** auth with the signing algorithm pinned (blocks downgrade attacks); the API refuses to boot in production without a secret.
- **Login hardening** — bcrypt (cost 12), account lockout after repeated failures, constant-time compares to prevent user enumeration, and per-IP rate limits.
- **Role-based access** throughout; managers vs. reps see different data; admin-only configuration.

**Data protection:**
- **Org-scoped multi-tenancy** — every record is scoped to its organization. *Isolation is currently enforced at the application-query layer for many models rather than by database foreign keys — a hardening item on the roadmap.*
- **Output hardening** — outbound email HTML is sanitized; file downloads are forced as attachments with `nosniff`; CSV exports are injection-safe; webhooks use constant-time secret comparison.
- **Password policy** — zxcvbn strength enforcement on user creation.

**KDPA (Kenya Data Protection Act):**
- Discovered contacts are **classified** as firmographic, role-based, or personal data.
- A configurable **gate/block mode** either strips personal identifiers (name/direct phone/LinkedIn) or excludes personal contacts entirely from prospecting output.
- **Data-subject deletion** (Article 35) — purge a person's data and suppress future contact.
- **Suppression lists** and one-click unsubscribe honor do-not-contact across the outbound engine.
- **GDPR export request** flow is supported for org data.

---

## 15. Plans & entitlements

Three commercial tiers gate features via server-enforced entitlements:

| Plan | Unlocks |
|---|---|
| **Lite** | Core CRM: leads, pipeline, activities, visits, tasks, calendar, documents, basic reports, and the core AI assists |
| **Pro** | Adds lead insights, communication drafts, quotations, weighted forecasting, targets & pacing, data-hygiene reports, geofencing, webhooks |
| **Enterprise** | Adds ERP sync (and is the home for future enterprise connectors) |

**License states** — active / grace / expired / read-only — drive an in-app banner and can put the workspace into read-only mode. Attempting a Pro feature on a Lite plan returns a clean "upgrade required" response and UI.

---

## 16. Platform & architecture

- **Monorepo** — npm workspaces: `shared` (Zod schemas + business rules), `api` (Fastify + Prisma), `web` (React 19 + Vite), `mobile` (React Native + Expo).
- **Database** — PostgreSQL via Prisma.
- **API** — Fastify, ESM, JWT-guarded, with per-route rate limiting on sensitive endpoints (login, discovery, sends).
- **Web** — React 19, React Router 7, Recharts, a collapsing-rail "Meridian" design system with runtime org theming.
- **Mobile** — native Android build (`com.wizag.wizcrm`) produced **fully locally** (Expo prebuild + Gradle, no cloud build service), expo-router, dark "field command center" UI.
- **Background work** — async discovery runs and a weekly Nairobi-time heat-map scheduler (node-cron).
- **Design principle** — offline-first on mobile; AI-optional everywhere; explainable-over-opaque for scoring.

---

## Appendix A — Data model

Core entities (PostgreSQL/Prisma), all UUID-keyed and organization-scoped:

| Entity | Represents |
|---|---|
| **Organization** | The tenant root; holds per-org settings, plan, and branding |
| **User** | Org member & record owner; role SALES/MANAGER/ADMIN |
| **Team** | A group of reps within an org |
| **Lead** | The central CRM object — contact, company, stage, priority, owner, tags, won/lost data |
| **StageChange** | Audit trail of pipeline moves (incl. whether AI-suggested) |
| **Activity** | Timeline entry (call/email/meeting/note/stage-change/etc.) |
| **LeadMessage / LeadAttachment** | Internal per-lead team chat + file attachments |
| **Task** | To-do, optionally lead-linked, with due date |
| **CalendarEvent** | Meeting/event with recurrence + geofenced check-in/out |
| **UserReminder** | Personal reminder |
| **SalesOpportunity** | Formal deal with probability & forecast |
| **Quotation / ErpSyncLog** | Line-item quote + ERP push audit |
| **ProductDocument** | Org-wide sales collateral |
| **AiSuggestion / AiAuditLog** | Pending AI proposals + full AI audit trail |
| **Campaign** | Outbound prospecting campaign (targeting + scoring rules) |
| **DiscoveryRun** | One execution of prospect discovery |
| **Prospect / ProspectContact / ProspectEnrichment** | Discovered company + its contacts + website enrichment |
| **EmailTemplate / EmailSequence / EmailSend** | Outbound drip content + per-email tracking |
| **IntentSignal** | A buyer-intent "heat map" signal |
| **SuppressionList** | Do-not-contact list |
| **ContactFinderCache / ContactFinderContact** | 30-day contact-lookup cache (with KDPA classification) |

---

## Appendix B — AI feature → model map

| Feature | Type | Model / engine | Human-in-loop | Audited |
|---|---|---|---|---|
| AI Visit Capture | Generative (STT + LLM) | Whisper + `gpt-4o-mini` | ✅ edits before save | ✅ |
| Voice-note transcription/cleanup | Generative | Whisper + `gpt-4o-mini` | ✅ | ✅ |
| Business-card OCR | Generative (vision) | `gpt-4o-mini` vision | ✅ | ✅ |
| Post-call structuring | Generative | `gpt-4o-mini` | ✅ confirm | ✅ |
| Lead summary | Generative | `gpt-4o-mini` | read-only | ✅ |
| Next-best-action | Generative | `gpt-4o-mini` | ✅ approve/dismiss | ✅ |
| Stage suggestion | Generative (guarded) | `gpt-4o-mini` | ✅ confirm | ✅ |
| Sales Desk ranking | Generative (opt-in) | `gpt-4o-mini` | read-only | ✅ |
| Smart lead capture | Generative + rules fallback | `gpt-4o-mini` | ✅ | ✅ |
| Manager brief summary | Generative (optional) | `gpt-4o-mini` | read-only | ✅ |
| Website enrichment | Generative (extraction) | Firecrawl LLM | — | — |
| ICP prospect scoring | Explainable rules | in-house | tunable per campaign | — |
| Lead insights (engagement/urgency/fit) | Explainable rules | in-house | read-only | — |
| Pipeline forecast | Deterministic math | in-house | read-only | — |
| Heat-map intent scoring | Heuristic over search APIs | in-house | read-only | — |
| Communication drafts | **Template today** (LLM on roadmap) | templates | ✅ before send | — |

---

*Generated from the WizCRM codebase (`api` · `web` · `mobile` · `shared`). For the AI internals, see `api/src/services/ai/`; for the Lead Engine, `api/src/services/lead-engine/`.*
