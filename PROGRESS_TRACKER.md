# WizCRM — Progress tracker

Track implementation against **[SRS.md](./SRS.md) v2.2** (AI-first, **Lite / Pro / Enterprise**).

**Legend:** ⬜ Not started · 🟡 In progress · ✅ Done · ⏸ Deferred · ❌ Cancelled · ➖ Waived (QA only, with reason in notes)

**Last updated:** 2026-05-17 (Lite foundation — Node API + LLM + mobile shell)

**Manager tasks:** [manager_task_tracker.md](./manager_task_tracker.md) (`MGT-*`)

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

## Summary

| Area | Total | Done | In progress | Not started |
|------|------:|-----:|------------:|------------:|
| Infrastructure | 10 | 4 | 2 | 4 |
| **Lite** features | 14 | 0 | 8 | 6 |
| **Lite** unit tests (`UT-LITE-*`) | 14 | 0 | 0 | 14 |
| **Lite** QA (`QA-LITE-*`) | 16 | 0 | 0 | 16 |
| **Lite** E2E (`E2E-LITE-*`) | 6 | 0 | 0 | 6 |
| Pro features | 15 | 0 | 0 | 15 |
| Enterprise features | 12 | 0 | 0 | 12 |
| Technical add-ons | 10 | 0 | 0 | 10 |
| ScaleGate | 5 | 0 | 0 | 5 |
| Non-functional | 8 | 0 | 0 | 8 |

*Update counts when checking off items.*

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
| 🟡 | INF-004 | Backend API + database | Lite+ |
| 🟡 | INF-005 | AI orchestration / LLM service layer (OpenAI) | Lite+ |
| ⬜ | INF-006 | Web app scaffold | Pro+ |
| ⬜ | INF-007 | CI (lint/test/build) | Pro+ |
| ⬜ | INF-008 | `tenant_id` schema (design for Pro) | Pro+ |
| ✅ | INF-009 | Test runners: API + `shared/` + `mobile/` (`npm test`) | Lite+ |
| ⬜ | INF-010 | Pre-push or CI runs `UT-*` for touched packages | Lite+ |

| Status | ID | Item | Pairs with |
|--------|-----|------|------------|
| 🟡 | UT-INF-004 | API route tests: auth, leads CRUD, activities, tasks | INF-004 |
| ✅ | UT-INF-005 | AI service: mock LLM, fallback, audit log shape | INF-005 |
| ⬜ | QA-INF-004 | Smoke: API up via Docker, health + login + one lead | INF-004 |

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
| ⬜ | UT-LITE-001 | Name required; phone OR email; company optional; API 400 on invalid | LITE-001 |
| ⬜ | UT-LITE-002 | Duplicate match on normalized phone/email; no false positive on new | LITE-002 |
| ⬜ | UT-LITE-003 | Card parse mapper: OCR/vision JSON → lead fields; empty safe | LITE-003 |
| ⬜ | UT-LITE-004 | Stage enum; allowed transitions; AI suggestion does not apply without confirm | LITE-004 |
| ⬜ | UT-LITE-005 | Desk ranking: due tasks, stale rules, max 3–5 items | LITE-005 |
| ⬜ | UT-LITE-006 | Summary generator with mock LLM; regen on new activity id | LITE-006 |
| ⬜ | UT-LITE-007 | Next action: one suggestion; dismiss / complete flags | LITE-007 |
| ⬜ | UT-LITE-008 | Note create; voice transcript → cleaned body (mock AI) | LITE-008 |
| ⬜ | UT-LITE-009 | Post-call DTO: call metadata + summary + suggested task | LITE-009 |
| ⬜ | UT-LITE-010 | Timeline sort DESC by time; filter by lead | LITE-010 |
| ⬜ | UT-LITE-011 | Task create/complete; overdue included in desk input | LITE-011 |
| ⬜ | UT-LITE-012 | Pipeline groups by stage; empty stage hidden or shown per spec | LITE-012 |
| ⬜ | UT-LITE-013 | Login issues token; invalid creds 401; secure store contract (mobile mock) | LITE-013 |
| ⬜ | UT-LITE-014 | Navigation shell: Desk / Leads / Pipeline routes mount | LITE-014 |

---

## WizCRM Lite — QA acceptance (`QA-LITE-*`)

Manual or scripted acceptance per [SRS.md](./SRS.md) §3.1. Record **Pass / Fail / Waived** and date in team notes.

| Status | ID | Acceptance check |
|--------|-----|------------------|
| ⬜ | QA-LITE-001 | Create lead in &lt; 20 s with name + phone or email |
| ⬜ | QA-LITE-002 | Saving duplicate phone/email shows warning; can cancel or proceed |
| ⬜ | QA-LITE-003 | Photo → prefill → edit → save; fields correct on detail |
| ⬜ | QA-LITE-004 | All 7 stages available; AI suggestion requires tap to confirm |
| ⬜ | QA-LITE-005 | Desk opens to 3–5 relevant items (hot / due follow-up) |
| ⬜ | QA-LITE-006 | Lead detail shows plain-language summary; updates after new activity |
| ⬜ | QA-LITE-007 | One next action shown; dismiss and complete work |
| ⬜ | QA-LITE-008 | Quick note on timeline; voice note becomes readable entry |
| ⬜ | QA-LITE-009 | After call: attach lead, rough input, AI summary + task, user confirms |
| ⬜ | QA-LITE-010 | Timeline shows notes, calls, stage changes in order |
| ⬜ | QA-LITE-011 | Task with due date; complete removes from desk due list |
| ⬜ | QA-LITE-012 | Pipeline view by stage; matches lead stage |
| ⬜ | QA-LITE-013 | Internal login only; no public signup |
| ⬜ | QA-LITE-014 | App runs on Android emulator and physical device |
| ⬜ | QA-LITE-ANDROID | Release smoke: install, login, one lead, one note, no crash |
| ⬜ | QA-LITE-PILOT | **Pilot script:** scan/add → desk → post-call or note → summary → pipeline (manager can view list) |

**NFR checks (Lite):**

| Status | ID | Check |
|--------|-----|-------|
| ⬜ | QA-NFR-004 | Airplane mode / API down: save manual note and minimal lead fields |
| ⬜ | QA-NFR-003 | AI suggest/approve logged (or stub documented until INF-005) |

---

## WizCRM Lite — E2E (`E2E-LITE-*`)

| Status | ID | Journey |
|--------|-----|---------|
| ⬜ | E2E-LITE-LOGIN | Login → authenticated home |
| ⬜ | E2E-LITE-LEAD | Create lead → list + pipeline |
| ⬜ | E2E-LITE-TIMELINE | Add note → visible on lead timeline |
| ⬜ | E2E-LITE-DESK | Task due → appears on Sales Desk |
| ⬜ | E2E-LITE-CARD | Card capture flow → saved lead |
| ⬜ | E2E-LITE-POSTCALL | Android post-call flow end-to-end |

---

## WizCRM Pro (~1 month)

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
