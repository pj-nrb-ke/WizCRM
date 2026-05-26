# WizCRM — Progress tracker

Track implementation against **[SRS.md](./SRS.md) v2.2** (AI-first, **Lite / Pro / Enterprise**).

**Legend:** ⬜ Not started · 🟡 In progress · ✅ Done · ⏸ Deferred · ❌ Cancelled · ➖ Waived (QA only, with reason in notes)

**Last updated:** 2026-05-27

**Phase status (top-level):** **[PHASE-STATUS.md](./PHASE-STATUS.md)**  
**Product roadmap phases:** **[WizCRM_Development_Phases.md](./WizCRM_Development_Phases.md)** (brochure Phase 1–3)  
**Outstanding work (task table):** **[OUTSTANDING-TASKS.md](./OUTSTANDING-TASKS.md)**  
**Web ↔ Mobile gaps:** **[docs/WEB-MOBILE-GAP-ANALYSIS.md](./docs/WEB-MOBILE-GAP-ANALYSIS.md)** (`MOB-GAP-*` by product phase)  
**Manager tasks:** [manager_task_tracker.md](./manager_task_tracker.md) (`MGT-*`)

---

## Product Phase 1 — Core CRM (brochure checklist)

**Overall:** 🟡 **~92% complete** — reps and managers can run the daily lead lifecycle on **app.wizcrm.app** + **production APK** (`WizCRM-production.apk`, built against `https://api.wizcrm.app`, commits `f1cbf03`+). Remaining items are web-admin polish (bulk assign, stale days, tags), not blockers for pilot use.

**Definition:** [WizCRM_Development_Phases.md](./WizCRM_Development_Phases.md) § Phase 1 — *not* the same as repo **P1** (Lite mobile build). Repo **P0–P6** map to Product Phase 1; see alignment table below.

### Repo phases → Product Phase 1

| Repo phase | Maps to Product Phase 1 | Status |
|------------|---------------------------|--------|
| P0 Hosting | Platforms (web + API live) | ✅ Done |
| P1 Lite build | Mobile baseline + **Phase 1 parity** | ✅ Done (`190e10a`, `f1cbf03`) |
| P2 Lite sign-off | Mobile QA gate | 🟡 Engineering QA ✅; **device pilot open** (`QA-LITE-ANDROID`, `QA-LITE-PILOT`) |
| P3 Web Cluster A | Web admin baseline | ✅ Done |
| P4 Web Cluster B | Manager workspace + reporting | ✅ Done (+ Phase 1 close/import slice, see `P1-*` below) |
| P5 Web polish | Teams / UX | ✅ Done |
| P6 Infra/CI | CI & automated tests | ✅ Done |

### Phase 1 feature status (`P1-*`)

| Status | ID | Area | Feature | Notes |
|--------|-----|------|---------|-------|
| ✅ | P1-CRM-001 | Core CRM | Lead management (contact, company, source, owner) | Web drawer + mobile detail/edit |
| ⬜ | P1-CRM-002 | Core CRM | **Lead tags** | Not in schema or UI |
| ✅ | P1-CRM-003 | Core CRM | Lead search & filters | `LeadsPage`, pipeline filters |
| ✅ | P1-CRM-004 | Core CRM | Lead detail (stage, history) | Drawer tabs; mobile timeline |
| ✅ | P1-CRM-005 | Core CRM | Duplicate detection (email/phone) | API + mobile create; **web create with warning** (`CreateLeadModal`) |
| 🟡 | P1-CRM-006 | Core CRM | **Assignment & handoff** | Owner at create/import; **no web “reassign owner” on lead** |
| 🟡 | P1-CRM-007 | Core CRM | **Audit trail** | Stage + activities on web & mobile timeline; **no owner-assignment history** |
| ✅ | P1-PIP-001 | Pipeline | Lifecycle stages (New → … → Won/Lost) | Shared enum + mobile/web |
| ✅ | P1-PIP-002 | Pipeline | Visual pipeline (Kanban) | `PipelinePage` |
| ✅ | P1-PIP-003 | Pipeline | Stage history | `StageChange` + audit UI |
| ✅ | P1-PIP-004 | Pipeline | Close Won (value, products) | Web modal + mobile `CloseLeadSheet`; deploy `79a7911` |
| ✅ | P1-PIP-005 | Pipeline | Close Lost (structured reasons) | Org CRM lists + close modal |
| ✅ | P1-PIP-006 | Pipeline | Reopen leads | Web + mobile “Reopen (Qualified)”; API clears won/lost fields |
| ✅ | P1-PIP-007 | Pipeline | Stale lead alerts | Manager home, desk rules, reports (fixed **7-day** threshold) |
| ✅ | P1-PIP-008 | Pipeline | Configurable stages | `PATCH /leads/pipeline/config` |
| ✅ | P1-ACT-001 | Activities | Unified timeline | Activities + stage changes in History |
| ✅ | P1-ACT-002 | Activities | Call / email / meeting logging (touchpoints) | Web `LogActivityForm` + mobile `LogActivitySheet` |
| 🟡 | P1-ACT-003 | Activities | Meetings (schedule, link to lead) | **Calendar events** on web; not full calendar sync (→ Product Phase 2) |
| ✅ | P1-ACT-004 | Activities | Tasks & reminders | API + mobile + drawer task list |
| ✅ | P1-ACT-005 | Activities | Internal notes | NOTE activities |
| ✅ | P1-ACT-006 | Activities | Next action on lead | AI next-action (mobile); not required on web for Phase 1 |
| ✅ | P1-RPT-001 | Reporting | Personal dashboard | `HomePage` KPIs |
| ✅ | P1-RPT-002 | Reporting | Manager dashboard (team funnel) | `ManagerHomePage` + drill-down |
| ✅ | P1-RPT-003 | Reporting | Export to CSV | `GET /reports/export.csv` |
| ✅ | P1-ADM-001 | Web admin | User & team management | `UsersPage`, `TeamsPage` |
| ✅ | P1-ADM-002 | Web admin | Sources & loss reasons | `/settings/crm` + `GET /leads/crm-config` |
| ⬜ | P1-ADM-003 | Web admin | **System settings (stale days, org defaults)** | Stale threshold **hardcoded 7 days** in API; not editable in admin UI |
| ✅ | P1-ADM-004 | Web admin | Bulk import | `/leads/import` + `BulkImportPage` |
| ⬜ | P1-ADM-005 | Web admin | **Bulk updates (assign / stage)** | No multi-select bulk PATCH UI |
| ✅ | P1-MOB-001 | Mobile | iOS & Android app | Expo / EAS APK |
| ✅ | P1-MOB-002 | Mobile | Tap-to-call & email | `phone-links` |
| ✅ | P1-MOB-003 | Mobile | Add leads on the go | `lead/new` |
| ✅ | P1-MOB-004 | Mobile | Compact mobile pipeline | `(tabs)/pipeline` |
| ✅ | P1-MOB-005 | Mobile | Post-call lead prompt | Android post-call flow |
| ✅ | P1-MOB-006 | Mobile | Close Won/Lost parity | `CloseLeadSheet` + org loss reasons via `GET /leads/crm-config` |
| ✅ | P1-SEC-001 | Security | Secure sign-in | JWT web + mobile |
| ✅ | P1-PLT-001 | Platforms | Web application | app.wizcrm.app |
| ✅ | P1-PLT-002 | Platforms | Mobile application | APK / Expo |

### Mobile Phase 1 delivery (install on device)

| Item | Status | Notes |
|------|--------|-------|
| Close Won/Lost (`CloseLeadSheet`) | ✅ | Deal value, products, org loss reasons |
| Log CALL / EMAIL / MEETING / NOTE (`LogActivitySheet`) | ✅ | Lead detail → **Log activity** |
| Stage + activity timeline | ✅ | Merged `stageChanges` + activities |
| Reopen closed lead | ✅ | **Reopen (Qualified)** |
| Org sources on new lead | ✅ | Chips from `GET /leads/crm-config` (all roles) |
| Production APK | ✅ | `.\scripts\build-apk.ps1 -Production` → repo root `WizCRM-production.apk` |

**Phase 1 mobile parity (2026-05):** Manager org snapshot + metric drill-down, team activity feed, personal dashboard on Desk, pipeline stage change/reorder + org stage labels (`MOB-GAP-101`–`105`, `108`). Rebuild APK after pull.

**Not on mobile (Phase 1 web-only or deferred):** bulk import, bulk assign, CRM lists admin, CSV export, lead tags, owner reassignment (`MOB-GAP-106`–`107`).

### Phase 1 — recommended closeout (remaining work)

| Priority | ID | Task | Suggested delivery |
|----------|-----|------|-------------------|
| 1 | P1-ADM-005 | Bulk assign owner / bulk stage change on web | Leads table multi-select + `PATCH` batch |
| 2 | P1-ADM-003 | Admin **stale days** in org settings | `Organization.settings` + Reports/Desk use value |
| 3 | P1-CRM-006 | Lead **reassign owner** in drawer | `PATCH` lead `ownerId` (manager) |
| 4 | P1-CRM-007 | **Owner assignment** audit entries | Log on owner change; show in History |
| 5 | P1-CRM-002 | Lead **tags** (optional for strict Phase 1) | Schema + filter chips |
| — | P2 / QA | **Device pilot** | `QA-LITE-ANDROID`, `QA-LITE-PILOT` — formal Lite sign-off, not a product feature gap |

**Phase 1 “done” criterion (product):** All `P1-*` rows ✅ **or** explicitly deferred (e.g. tags → Phase 2), plus P2 device pilot signed for mobile quality.

---

## Product Phase 2 — Field proof, analytics & integrations (kickoff)

**Overall:** 🟡 **~35% complete** — first delivery slice: advanced reports, webhook lead capture, quotations on leads, calendar meeting location + check-in/out on web, mobile offline sync button.

**Definition:** [WizCRM_Development_Phases.md](./WizCRM_Development_Phases.md) § Phase 2 · Repo **P7–P8** map here.

### Phase 2 feature status (`P2-*`)

| Status | ID | Area | Feature | Notes |
|--------|-----|------|---------|-------|
| 🟡 | P2-FLD-001 | Field sales | Push notifications | Not started |
| 🟡 | P2-FLD-002 | Field sales | Offline mobile (draft + sync) | Queue exists; **Sync now** on lead detail |
| 🟡 | P2-MTG-001 | Meeting & attendance | Meeting destination + maps | Web calendar address/lat/lng + Google Maps link |
| 🟡 | P2-MTG-002 | Meeting & attendance | Geofence check-in / check-out | API + web check-in/out (GPS when available); no geofence radius yet |
| ⬜ | P2-MTG-003 | Meeting & attendance | Attendance reports | Not started |
| ✅ | P2-RPT-001 | Reporting | Conversion funnel analytics | `conversionFunnel` on `/reports/summary` + charts |
| ✅ | P2-RPT-002 | Reporting | Time in stage | `timeInStage` on reports API + bar chart |
| 🟡 | P2-RPT-003 | Reporting | Win/loss analysis | Phase 1 loss reasons; advanced cohort views TBD |
| ⬜ | P2-RPT-004 | Reporting | Saved views | Not started |
| ✅ | P2-QTE-001 | Quotations | Lines, tax, link to lead | `Quotation` model + drawer UI + API |
| ✅ | P2-INT-001 | Integrations | Webhook lead capture | `POST /integrations/webhook/leads` + admin enable |
| ⬜ | P2-INT-002 | Integrations | Automation rules | Not started |
| ⬜ | P2-CAL-001 | Calendar sync | Google / Microsoft sync | Beyond Phase 1 event CRUD |
| ⬜ | P2-ADM-001 | Admin depth | Custom fields, branding | Not started |

**Phase 2 “done” criterion (product):** Field attendance proof on mobile + manager reports; quotations + webhook in daily use; analytics beyond Phase 1 baseline.

---

## Phase status

| Phase | Name | Status | Notes |
|-------|------|--------|-------|
| **P0** | Production hosting | ✅ Done | api + app on Contabo |
| **P1** | Lite mobile (build) | ✅ Done | APK + Lite+ Pro; **Phase 1 parity** close/log/timeline/reopen (`f1cbf03`) |
| **P2** | Lite sign-off (UT/QA/E2E) | 🟡 In progress | **Engineering QA done** — [QA-AUTOMATED-SIGNOFF.md](./docs/QA-AUTOMATED-SIGNOFF.md); user device only |
| **P3** | Web Cluster A (admin) | ✅ Done | WEB-001–015 |
| **P4** | Web Cluster B (manager) | ✅ Done | WEB-020–023; Phase 1 slice: close Won/Lost, bulk import, CRM lists (`79a7911`) |
| **P5** | Web polish | ✅ Done | WEB-012 teams CRUD + `teams-integration.test.ts` |
| **P6** | Infrastructure & CI | ✅ Done | CI unit+integration+web build; `run-qa-automated.ps1` |
| **P7** | Pro platform (Cluster C) | ⬜ Not started | Multi-tenant + ScaleGate |
| **P8** | Pro product features | 🟡 In progress | Phase 2 slice: analytics, webhook, quotations, calendar check-in |
| **P9** | Enterprise | ⬜ Not started | ENT-* |
| **P10** | Web Cluster D | ⏸ Deferred | WEB-030–033 |
| **P11** | Business (MGT) | 🟡 In progress | DNS done; stores/legal/ERP open |

Full phase narrative: **[PHASE-STATUS.md](./PHASE-STATUS.md)**

---

## Task ID reference (discussion & commits)

| Prefix | Use in conversation / commits |
|--------|-------------------------------|
| `LITE-*` | Feature delivered (mobile Lite) |
| `UT-*` | Unit / automated tests — **required before** marking `LITE-*` done |
| `QA-*` | Acceptance / manual QA checklist |
| `E2E-*` | End-to-end journey tests |
| `INF-*` | Platform (API, DB, test harness) |
| `TOOL-*` | Native modules & external APIs |

**Definition of done:** `LITE-00N` ✅ only when paired `UT-LITE-00N` ✅ and `QA-LITE-00N` ✅ (and any listed `E2E-*` ✅).

**Commit examples:** `feat(mobile): LITE-001 lead inbox` · `test(api): UT-LITE-002 duplicate detection` · `docs: mark QA-LITE-PILOT pass`

---

## Summary (by phase — see [PHASE-STATUS.md](./PHASE-STATUS.md))

| Phase | Status |
|-------|--------|
| P0 Hosting | ✅ |
| P1 Lite build | ✅ |
| P2 Lite sign-off | 🟡 (user device) |
| P3–P4 Web A+B | ✅ |
| **Product Phase 1 (brochure)** | 🟡 ~92% — see **`P1-*`** + mobile delivery table above |
| P5 Web polish | ✅ |
| P6 Infra/CI | ✅ |
| P7–P9 Pro / Enterprise | ⬜ |
| P10 Web D | ⏸ |
| P11 Business | 🟡 |

*Granular task counts: remove rows from [OUTSTANDING-TASKS.md](./OUTSTANDING-TASKS.md) as work completes.*

---

## Lite traceability matrix

| Feature | Unit test | QA acceptance | E2E |
|---------|-----------|---------------|-----|
| LITE-001 | UT-LITE-001 | QA-LITE-001 | E2E-LITE-LEAD |
| LITE-002 | UT-LITE-002 | QA-LITE-002 | E2E-LITE-LEAD |
| LITE-003 | UT-LITE-003 | QA-LITE-003 | E2E-LITE-CARD |
| LITE-004 | UT-LITE-004 | QA-LITE-004 | — |
| LITE-005 | UT-LITE-005 | QA-LITE-005 | E2E-LITE-DESK |
| LITE-006 | UT-LITE-006 | QA-LITE-006 | — |
| LITE-007 | UT-LITE-007 | QA-LITE-007 | — |
| LITE-008 | UT-LITE-008 | QA-LITE-008 | E2E-LITE-TIMELINE |
| LITE-009 | UT-LITE-009 | QA-LITE-009 | E2E-LITE-POSTCALL |
| LITE-010 | UT-LITE-010 | QA-LITE-010 | E2E-LITE-TIMELINE |
| LITE-011 | UT-LITE-011 | QA-LITE-011 | E2E-LITE-DESK |
| LITE-012 | UT-LITE-012 | QA-LITE-012 | — |
| LITE-013 | UT-LITE-013 | QA-LITE-013 | E2E-LITE-LOGIN |
| LITE-014 | UT-LITE-014 | QA-LITE-014 | QA-LITE-ANDROID |

**Pilot sign-off:** `QA-LITE-PILOT` (after all Lite rows above are ✅ or explicitly waived).

---

## Infrastructure

| Status | ID | Item | Tier |
|--------|-----|------|------|
| ✅ | INF-001 | Git repo + `development` branch | All |
| ✅ | INF-002 | Expo mobile scaffold | All |
| ✅ | INF-003 | Folder layout `web/`, `shared/`, `docker/` | All |
| ✅ | INF-004 | Backend API + database | Lite+ |
| ✅ | INF-005 | AI orchestration / LLM service layer (OpenAI) | Lite+ |
| ✅ | INF-006 | Web app scaffold (`WEB-001`–`004`) | Pro+ — **Cluster A** |
| ✅ | INF-007 | CI (lint/test/build) | Pro+ |
| ⬜ | INF-008 | `tenant_id` schema (design for Pro) | Pro+ |
| ✅ | INF-009 | Test runners: API + `shared/` + `mobile/` (`npm test`) | Lite+ |
| ✅ | INF-010 | CI runs `UT-*` on push/PR (unit + integration jobs) | Lite+ |

| Status | ID | Item | Pairs with |
|--------|-----|------|------------|
| ✅ | UT-INF-004 | API route tests: auth, leads CRUD, activities, tasks, teams | INF-004 |
| ✅ | UT-INF-005 | AI service: mock LLM, fallback, audit log shape | INF-005 |
| ✅ | QA-INF-004 | Smoke: integration job (db push, seed, API inject) | INF-004 |

---

## WizCRM Lite — features (`LITE-*`)

| Status | ID | Feature |
|--------|-----|---------|
| 🟡 | LITE-001 | Lead Inbox (minimal fields) |
| 🟡 | LITE-002 | Duplicate detection |
| 🟡 | LITE-003 | Business card capture |
| 🟡 | LITE-004 | Lifecycle stages + AI suggest / user confirm |
| 🟡 | LITE-005 | AI Sales Desk (basic) |
| 🟡 | LITE-006 | AI Lead Summary |
| 🟡 | LITE-007 | AI Next Action |
| 🟡 | LITE-008 | Quick note + voice → AI timeline |
| 🟡 | LITE-009 | Post-call prompt (Android) |
| 🟡 | LITE-010 | Activity timeline |
| 🟡 | LITE-011 | Follow-up tasks |
| 🟡 | LITE-012 | Simple pipeline by stage |
| 🟡 | LITE-013 | Auth (single org, internal) |
| 🟡 | LITE-014 | Mobile-first delivery |

---

## WizCRM Lite — unit tests (`UT-LITE-*`)

Run with project test command after `INF-009`. Add/update in the **same PR** as the feature.

| Status | ID | Tests (critical points) | Blocks |
|--------|-----|-------------------------|--------|
| ✅ | UT-LITE-001 | Name required; phone OR email; company optional; API 400 on invalid | LITE-001 |
| ✅ | UT-LITE-002 | Duplicate match on normalized phone/email; no false positive on new | LITE-002 |
| ✅ | UT-LITE-003 | Card parse mapper: OCR/vision JSON → lead fields; empty safe | LITE-003 |
| ✅ | UT-LITE-004 | Stage enum; allowed transitions; AI suggestion does not apply without confirm | LITE-004 |
| ✅ | UT-LITE-005 | Desk ranking: due tasks, stale rules, max 3–5 items | LITE-005 |
| ✅ | UT-LITE-006 | Summary: AI_UNAVAILABLE without key; endpoint 200/503 in integration | LITE-006 |
| ✅ | UT-LITE-007 | Next action: one suggestion; dismiss / complete flags | LITE-007 |
| ✅ | UT-LITE-008 | Note create; voice transcript → cleaned body (mock AI) | LITE-008 |
| ✅ | UT-LITE-009 | Post-call DTO: call metadata + summary + suggested task | LITE-009 |
| ✅ | UT-LITE-010 | Timeline sort DESC by time; filter by lead | LITE-010 |
| ✅ | UT-LITE-011 | Task create/complete; overdue included in desk input | LITE-011 |
| ✅ | UT-LITE-012 | Pipeline groups by stage; empty stage hidden or shown per spec | LITE-012 |
| ✅ | UT-LITE-013 | Login issues token; invalid creds 401; secure store contract (mobile mock) | LITE-013 |
| ✅ | UT-LITE-014 | Navigation shell: Desk / Leads / Pipeline routes mount | LITE-014 |

---

## WizCRM Lite — QA acceptance (`QA-LITE-*`)

Manual or scripted acceptance per [SRS.md](./SRS.md) §3.1. Record **Pass / Fail / Waived** and date in team notes.

| Status | ID | Acceptance check |
|--------|-----|------------------|
| ✅ | QA-LITE-001 | Create lead — **API automated** |
| ✅ | QA-LITE-002 | Duplicate 409 — **API automated** |
| ⬜ | QA-LITE-003 | Photo → prefill — **device** |
| ✅ | QA-LITE-004 | Stage rules + PATCH — **API**; tap-to-confirm UI **device** |
| ✅ | QA-LITE-005 | Desk items — **API automated** |
| ✅ | QA-LITE-006 | Summary endpoint — **API automated** |
| ✅ | QA-LITE-007 | Next-action dismiss — **API**; UI **device** |
| ✅ | QA-LITE-008 | Note on timeline — **API**; voice **device** |
| ✅ | QA-LITE-009 | Post-call confirm — **API automated** |
| ✅ | QA-LITE-010 | Timeline order — **API automated** |
| ✅ | QA-LITE-011 | Task + desk — **API automated** |
| ✅ | QA-LITE-012 | Pipeline bucket — **API automated** |
| ✅ | QA-LITE-013 | No signup; 401 — **API automated** |
| ⬜ | QA-LITE-014 | App runs on Android emulator and physical device |
| ⬜ | QA-LITE-ANDROID | Release smoke: install, login, one lead, one note, no crash |
| ⬜ | QA-LITE-PILOT | **Pilot script:** scan/add → desk → post-call or note → summary → pipeline (manager can view list) |

**NFR checks (Lite):**

| Status | ID | Check |
|--------|-----|-------|
| 🟡 | QA-NFR-004 | Airplane mode / API down: save manual note and minimal lead fields — **manual on device** |
| ⬜ | QA-NFR-003 | AI suggest/approve logged (or stub documented until INF-005) |

---

## WizCRM Lite — E2E (`E2E-LITE-*`)

| Status | ID | Journey |
|--------|-----|---------|
| ✅ | E2E-LITE-LOGIN | Login → authenticated home |
| ✅ | E2E-LITE-LEAD | Create lead → list + pipeline |
| ✅ | E2E-LITE-TIMELINE | Add note → visible on lead timeline |
| ✅ | E2E-LITE-DESK | Task due → appears on Sales Desk |
| 🟡 | E2E-LITE-CARD | Card capture flow → saved lead (device) |
| 🟡 | E2E-LITE-POSTCALL | Android post-call flow end-to-end (API confirm gate covered in UT) |

---

## WizCRM Pro (~1 month)

## WizCRM Web — phased (`WEB-*`)

See **[SRS-WEB.md](./SRS-WEB.md)**. Clusters **A** and **B** are done; see **[OUTSTANDING-TASKS.md](./OUTSTANDING-TASKS.md)** for what remains.

| Status | ID | Feature |
|--------|-----|---------|
| ✅ | WEB-001 | Web scaffold + deploy `app.wizcrm.app` |
| ✅ | WEB-002 | Auth (JWT, roles) |
| ✅ | WEB-003 | App shell + role-based nav |
| ✅ | WEB-004 | API client (`VITE_API_URL`) |
| ✅ | WEB-010 | Organization profile |
| ✅ | WEB-011 | Users admin (PRO-013 slice) |
| ✅ | WEB-012 | Teams admin CRUD on web (`TeamsPage.tsx`) |
| ✅ | WEB-013 | AI & platform settings (desk mode, health) |
| ✅ | WEB-014 | Connection info for mobile |
| ✅ | WEB-015 | AI audit log (read-only) |
| ✅ | API-WEB-001..004 | Admin settings API routes |
| ✅ | WEB-020 | Manager home (team stats) |
| ✅ | WEB-021 | Pipeline board |
| ✅ | WEB-022 | Leads table + drawer |
| ✅ | WEB-023 | Reports + CSV export |
| ✅ | WEB-024 | Lead drawer: close Won/Lost, activity log, audit History |
| ✅ | WEB-025 | Bulk lead import (`/leads/import`) |
| ✅ | WEB-026 | CRM lists admin (sources, loss reasons) |
| ✅ | WEB-027 | Create lead + duplicate warning (web) |

| Cluster | IDs | When |
|---------|-----|------|
| **A — Foundation + settings** | INF-006, WEB-001–015, API-WEB-* | Done |
| **B — Manager workspace** | WEB-020–023 | Done |
| **C — Pro platform** | PRO-014, PRO-015, INF-008 | Before external SaaS |
| **D — Sales CRM on web** | WEB-030–033 | Defer |

*Add `UT-PRO-*` and `QA-PRO-*` when Pro development starts (same pairing rules as Lite).*

| Status | ID | Feature |
|--------|-----|---------|
| ⬜ | PRO-001 | Smart lead capture + AI source/priority |
| ⬜ | PRO-002 | AI Sales Desk (full) |
| ⬜ | PRO-003 | Lead Detail scores + risk |
| ⬜ | PRO-004 | Activity capture (call outcomes, meetings, voice) |
| ⬜ | PRO-005 | AI Follow-up Engine |
| ⬜ | PRO-006 | Communication drafts (approve to send) |
| ⬜ | PRO-007 | Pipeline AI + basic forecast |
| ⬜ | PRO-008 | Data hygiene |
| ⬜ | PRO-009 | Manager Cockpit |
| ⬜ | PRO-010 | Targets & pacing |
| ⬜ | PRO-011 | Quotations Lite |
| ⬜ | PRO-012 | Reporting + CSV export |
| ⬜ | PRO-013 | Admin (users, teams, roles, branding) |
| ⬜ | PRO-014 | Multi-tenant SaaS |
| ⬜ | PRO-015 | ScaleGate licensing (`pro`) |

| Status | ID | QA (placeholder) |
|--------|-----|------------------|
| ⬜ | QA-PRO-PILOT | Pro tier sign-off: multi-tenant + ScaleGate + manager cockpit |

---

## WizCRM Enterprise

*Add `UT-ENT-*` and `QA-ENT-*` when Enterprise development starts.*

| Status | ID | Feature |
|--------|-----|---------|
| ⬜ | ENT-001 | Field Sales (map, navigate, geofence) |
| ⬜ | ENT-002 | Field visit analytics + exceptions |
| ⬜ | ENT-003 | ERP connector framework |
| ⬜ | ENT-004 | ERP customer sync |
| ⬜ | ENT-005 | ERP quotation sync |
| ⬜ | ENT-006 | Integrations (web forms, webhooks, calendar) |
| ⬜ | ENT-007 | Campaign / source ROI |
| ⬜ | ENT-008 | Account growth AI |
| ⬜ | ENT-009 | Advanced pipeline / reports |
| ⬜ | ENT-010 | Enterprise security (SSO, 2FA, etc.) |
| ⬜ | ENT-011 | ScaleGate `enterprise` + metering |
| ⬜ | ENT-012 | Optional: e-sign, Slack/Teams |

| Status | ID | QA (placeholder) |
|--------|-----|------------------|
| ⬜ | QA-ENT-PILOT | Enterprise sign-off: geofence + ERP sandbox + SSO smoke |

### ERP connectors (when SDKs provided)

| Status | ID | System |
|--------|-----|--------|
| ⬜ | ERP-SAGE | SAGE Evolution 200 |
| ⬜ | ERP-SAPB1 | SAP Business One |
| ⬜ | ERP-QB | QuickBooks |
| ⬜ | ERP-TALLY | Tally |

---

## Technical add-ons (TOOL-*)

| Status | ID | Item | Lite | Pro | Ent |
|--------|-----|------|:----:|:---:|:---:|
| 🟡 | TOOL-001 | LLM / AI orchestration | ● | ● | ● |
| 🟡 | TOOL-002 | Card scan (camera + OCR/vision) | ● | ● | ● |
| 🟡 | TOOL-003 | `expo-secure-store` | ● | ● | ● |
| ⬜ | TOOL-004 | Call detection (Android) | ● | ● | ● |
| ⬜ | TOOL-005 | Push notifications | — | ● | ● |
| ⬜ | TOOL-006 | ScaleGate HTTP client | — | ● | ● |
| ⬜ | TOOL-007 | Geofence (`expo-location`, etc.) | — | — | ● |
| ⬜ | TOOL-008 | Maps / Geocoding | — | — | ● |
| ⬜ | TOOL-009 | `integrations/erp/` | — | stub | ● |
| ⬜ | TOOL-010 | EAS production builds | — | ● | ● |

---

## ScaleGate (SG-*)

| Status | ID | Item | Tier |
|--------|-----|------|------|
| ⬜ | SG-001 | License system of record | Pro+ |
| ⬜ | SG-002 | Plans: lite / pro / enterprise | Pro+ |
| ⬜ | SG-003 | Validate + grace period | Pro+ |
| ⬜ | SG-004 | Seat limits | Pro+ |
| ⬜ | SG-005 | `LICENSE_DEV_MODE` | Dev |

---

## Non-functional (NFR-*)

| Status | ID | Item | Lite | Pro | Ent |
|--------|-----|------|:----:|:---:|:---:|
| ⬜ | NFR-001 | HTTPS / secure API | ● | ● | ● |
| ⬜ | NFR-002 | Tenant isolation | — | ● | ● |
| ⬜ | NFR-003 | AI audit log | ● | ● | ● |
| ⬜ | NFR-004 | AI graceful degradation | ● | ● | ● |
| ⬜ | NFR-005 | GDPR export/delete | — | ● | ● |
| ⬜ | NFR-006 | List performance | — | ● | ● |
| ⬜ | NFR-007 | Observability | ● | ● | ● |
| ⬜ | NFR-008 | i18n-ready | ● | ● | ● |

---

## Superseded (SRS v1.x)

Requirements `FR-*` from SRS v1.0–1.2 are **superseded** by v2.0 tier IDs above. See git history for the legacy tracker layout.

---

## How to update

1. Implement `LITE-*` (or `PRO-*` / `ENT-*`).
2. Add/pass `UT-*` in the same change set.
3. Run `QA-*` checklist; mark ✅ or ➖ with reason.
4. Run relevant `E2E-*` when the journey exists.
5. Update **Summary** counts and commit: `docs: mark LITE-003, UT-LITE-003, QA-LITE-003 complete`.

**Agent / dev workflow:** Always state Task IDs in status updates (e.g. “Starting `INF-004` + `UT-INF-004`”).

---

## Related

- [SRS.md](./SRS.md) — Requirements v2.2 (§11 testing policy)  
- [WizCRM Features.md](./WizCRM%20Features.md) — Brochure by tier  
- [manager_task_tracker.md](./manager_task_tracker.md) — `MGT-*`  
- [MOBILE_DEV.md](./MOBILE_DEV.md) — Mobile toolchain
