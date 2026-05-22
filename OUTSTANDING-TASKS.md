# WizCRM — Outstanding tasks (single list)

**Phase-level status:** **[PHASE-STATUS.md](./PHASE-STATUS.md)** ← start here  
**Legend:** 🟡 In progress (built but not signed off) · ⬜ Not started  
**Detail sections:** [PROGRESS_TRACKER.md](./PROGRESS_TRACKER.md) · Manager: [manager_task_tracker.md](./manager_task_tracker.md)  
**Last updated:** 2026-05-22

## Phase snapshot

| Phase | Name | Status |
|-------|------|--------|
| P0 | Production hosting | ✅ |
| P1 | Lite mobile (build) | 🟡 |
| P2 | Lite sign-off (UT/QA/E2E) | 🟡 |
| P3 | Web Cluster A (admin) | ✅ |
| P4 | Web Cluster B (manager) | ✅ |
| P5 | Web polish (WEB-012) | 🟡 |
| P6 | Infrastructure & CI | 🟡 |
| P7 | Pro platform | ⬜ |
| P8 | Pro features | ⬜ |
| P9 | Enterprise | ⬜ |
| P10 | Web Cluster D | ⏸ |
| P11 | Business (MGT) | 🟡 |

---

## All open tasks (by ID)

| Status | ID | Area | Task | Priority |
|--------|-----|------|------|----------|
| 🟡 | WEB-012 | Web | Teams admin on web (view only; create/edit still mobile) | **High** |
| 🟡 | LITE-001 | Lite | Lead inbox — finish UT + QA | **High** |
| 🟡 | LITE-002 | Lite | Duplicate detection — finish UT + QA | **High** |
| 🟡 | LITE-003 | Lite | Business card capture — finish UT + QA | **High** |
| 🟡 | LITE-004 | Lite | Lifecycle stages + AI suggest — finish QA | **High** |
| 🟡 | LITE-005 | Lite | AI Sales Desk (basic) — finish UT + QA | **High** |
| 🟡 | LITE-006 | Lite | AI lead summary — finish UT + QA | **High** |
| 🟡 | LITE-007 | Lite | AI next action — finish QA | **High** |
| 🟡 | LITE-008 | Lite | Quick note + voice timeline — finish QA | **High** |
| 🟡 | LITE-009 | Lite | Post-call prompt (Android) — finish QA + E2E | **High** |
| 🟡 | LITE-010 | Lite | Activity timeline — finish UT + QA | **High** |
| 🟡 | LITE-011 | Lite | Follow-up tasks — finish UT + QA | **High** |
| 🟡 | LITE-012 | Lite | Pipeline by stage — finish UT + QA | **High** |
| 🟡 | LITE-013 | Lite | Auth (single org) — finish UT + QA | **High** |
| 🟡 | LITE-014 | Lite | Mobile-first delivery — finish UT + QA | **High** |
| ⬜ | QA-LITE-PILOT | Lite QA | End-to-end pilot sign-off script | **High** |
| ⬜ | QA-LITE-ANDROID | Lite QA | Release APK smoke (install, login, lead, note) | **High** |
| ⬜ | UT-LITE-001 | Lite UT | Lead create validation | **High** |
| ⬜ | UT-LITE-002 | Lite UT | Duplicate detection | **High** |
| ⬜ | UT-LITE-003 | Lite UT | Card parse mapper | **High** |
| ⬜ | UT-LITE-005 | Lite UT | Desk ranking rules | **High** |
| ⬜ | UT-LITE-006 | Lite UT | Summary generator (mock LLM) | **High** |
| ⬜ | UT-LITE-010 | Lite UT | Timeline sort / filter | **High** |
| ⬜ | UT-LITE-011 | Lite UT | Task create/complete + desk input | **High** |
| ⬜ | UT-LITE-012 | Lite UT | Pipeline grouping by stage | **High** |
| ⬜ | UT-LITE-013 | Lite UT | Login / JWT / 401 | **High** |
| ⬜ | UT-LITE-014 | Lite UT | Mobile nav shell routes | **High** |
| ⬜ | QA-LITE-001 | Lite QA | Create lead &lt; 20s | **High** |
| ⬜ | QA-LITE-002 | Lite QA | Duplicate warning flow | **High** |
| ⬜ | QA-LITE-003 | Lite QA | Card photo → save | **High** |
| 🟡 | QA-LITE-004 | Lite QA | Stages + AI confirm (manual device) | **High** |
| ⬜ | QA-LITE-005 | Lite QA | Desk 3–5 items | **High** |
| ⬜ | QA-LITE-006 | Lite QA | Lead summary updates | **High** |
| 🟡 | QA-LITE-007 | Lite QA | Next action dismiss/complete (manual) | **High** |
| 🟡 | QA-LITE-008 | Lite QA | Note + voice on timeline (manual) | **High** |
| ⬜ | QA-LITE-009 | Lite QA | Post-call flow | **High** |
| ⬜ | QA-LITE-010 | Lite QA | Timeline order | **High** |
| ⬜ | QA-LITE-011 | Lite QA | Tasks + desk | **High** |
| ⬜ | QA-LITE-012 | Lite QA | Pipeline matches stage | **High** |
| ⬜ | QA-LITE-013 | Lite QA | Internal login only | **High** |
| ⬜ | QA-LITE-014 | Lite QA | Emulator + physical device | **High** |
| ⬜ | E2E-LITE-LOGIN | Lite E2E | Login → home | **High** |
| ⬜ | E2E-LITE-LEAD | Lite E2E | Create lead → list + pipeline | **High** |
| ⬜ | E2E-LITE-DESK | Lite E2E | Due task on desk | **High** |
| ⬜ | E2E-LITE-CARD | Lite E2E | Card capture → saved lead | **High** |
| 🟡 | E2E-LITE-POSTCALL | Lite E2E | Post-call Android E2E | **High** |
| 🟡 | INF-004 | Infra | Backend API + DB — close UT-INF-004 + QA-INF-004 | **Medium** |
| 🟡 | INF-005 | Infra | AI / OpenAI layer — production hardening | **Medium** |
| 🟡 | INF-006 | Infra | Web scaffold — mark ✅ (live on app.wizcrm.app) | **Medium** |
| ⬜ | INF-007 | Infra | CI lint / test / build | **Medium** |
| ⬜ | INF-010 | Infra | Pre-push or CI runs UT-* | **Medium** |
| 🟡 | UT-INF-004 | Infra UT | API route tests (auth, leads, activities, tasks) | **Medium** |
| ⬜ | QA-INF-004 | Infra QA | API smoke via Docker | **Medium** |
| 🟡 | TOOL-001 | Tools | LLM orchestration — harden | **Medium** |
| 🟡 | TOOL-002 | Tools | Card scan / vision | **Medium** |
| 🟡 | TOOL-003 | Tools | expo-secure-store | **Medium** |
| ⬜ | TOOL-004 | Tools | Call detection (Android) | **Medium** |
| 🟡 | QA-NFR-004 | NFR QA | Offline / API down note (manual) | **Medium** |
| ⬜ | QA-NFR-003 | NFR QA | AI suggest/approve logged | **Medium** |
| ⬜ | NFR-001 | NFR | HTTPS / secure API (verify + sign off) | **Medium** |
| ⬜ | NFR-003 | NFR | AI audit log (formal sign-off) | **Medium** |
| ⬜ | NFR-004 | NFR | AI graceful degradation (formal sign-off) | **Medium** |
| ⬜ | NFR-007 | NFR | Observability | **Medium** |
| ⬜ | NFR-008 | NFR | i18n-ready | **Low** |
| ⬜ | INF-008 | Pro infra | `tenant_id` schema design | **Pro** |
| ⬜ | PRO-014 | Pro | Multi-tenant SaaS | **Pro** |
| ⬜ | PRO-015 | Pro | ScaleGate licensing | **Pro** |
| ⬜ | SG-001 | ScaleGate | License system of record | **Pro** |
| ⬜ | SG-002 | ScaleGate | Plans lite / pro / enterprise | **Pro** |
| ⬜ | SG-003 | ScaleGate | Validate + grace period | **Pro** |
| ⬜ | SG-004 | ScaleGate | Seat limits | **Pro** |
| ⬜ | SG-005 | ScaleGate | LICENSE_DEV_MODE | **Pro** |
| ⬜ | PRO-001 | Pro | Smart lead capture + AI source/priority | **Pro** |
| ⬜ | PRO-002 | Pro | AI Sales Desk (full) | **Pro** |
| ⬜ | PRO-003 | Pro | Lead detail scores + risk | **Pro** |
| ⬜ | PRO-004 | Pro | Activity capture (calls, meetings, voice) | **Pro** |
| ⬜ | PRO-005 | Pro | AI follow-up engine | **Pro** |
| ⬜ | PRO-006 | Pro | Communication drafts | **Pro** |
| ⬜ | PRO-007 | Pro | Pipeline AI + forecast | **Pro** |
| ⬜ | PRO-008 | Pro | Data hygiene | **Pro** |
| ⬜ | PRO-009 | Pro | Manager cockpit (beyond web B) | **Pro** |
| ⬜ | PRO-010 | Pro | Targets & pacing | **Pro** |
| ⬜ | PRO-011 | Pro | Quotations Lite | **Pro** |
| ⬜ | PRO-012 | Pro | Reporting (advanced; web has CSV slice) | **Pro** |
| ⬜ | PRO-013 | Pro | Admin branding + full PRO-013 | **Pro** |
| ⬜ | QA-PRO-PILOT | Pro QA | Pro tier sign-off | **Pro** |
| ⬜ | TOOL-005 | Tools | Push notifications | **Pro** |
| ⬜ | TOOL-006 | Tools | ScaleGate HTTP client | **Pro** |
| ⬜ | TOOL-010 | Tools | EAS production builds | **Pro** |
| ⬜ | NFR-002 | NFR | Tenant isolation | **Pro** |
| ⬜ | NFR-005 | NFR | GDPR export/delete | **Pro** |
| ⬜ | NFR-006 | NFR | List performance | **Pro** |
| ⬜ | ENT-001 | Enterprise | Field sales + geofence | **Enterprise** |
| ⬜ | ENT-002 | Enterprise | Field visit analytics | **Enterprise** |
| ⬜ | ENT-003 | Enterprise | ERP connector framework | **Enterprise** |
| ⬜ | ENT-004 | Enterprise | ERP customer sync | **Enterprise** |
| ⬜ | ENT-005 | Enterprise | ERP quotation sync | **Enterprise** |
| ⬜ | ENT-006 | Enterprise | Integrations (forms, webhooks, calendar) | **Enterprise** |
| ⬜ | ENT-007 | Enterprise | Campaign / source ROI | **Enterprise** |
| ⬜ | ENT-008 | Enterprise | Account growth AI | **Enterprise** |
| ⬜ | ENT-009 | Enterprise | Advanced pipeline / reports | **Enterprise** |
| ⬜ | ENT-010 | Enterprise | SSO, 2FA, enterprise security | **Enterprise** |
| ⬜ | ENT-011 | Enterprise | ScaleGate enterprise + metering | **Enterprise** |
| ⬜ | ENT-012 | Enterprise | E-sign, Slack/Teams (optional) | **Enterprise** |
| ⬜ | QA-ENT-PILOT | Enterprise QA | Enterprise sign-off | **Enterprise** |
| ⬜ | ERP-SAGE | ERP | SAGE Evolution 200 connector | **Enterprise** |
| ⬜ | ERP-SAPB1 | ERP | SAP Business One connector | **Enterprise** |
| ⬜ | ERP-QB | ERP | QuickBooks connector | **Enterprise** |
| ⬜ | ERP-TALLY | ERP | Tally connector | **Enterprise** |
| ⬜ | TOOL-007 | Tools | Geofence | **Enterprise** |
| ⬜ | TOOL-008 | Tools | Maps / geocoding | **Enterprise** |
| ⬜ | TOOL-009 | Tools | integrations/erp/ | **Enterprise** |
| ⏸ | WEB-030 | Web (defer) | Full desk AI on web | **Deferred** |
| ⏸ | WEB-031 | Web (defer) | Lead detail + AI panels on web | **Deferred** |
| ⏸ | WEB-032 | Web (defer) | Quotes UI on web | **Deferred** |
| ⏸ | WEB-033 | Web (defer) | Communication drafts on web | **Deferred** |
| ⬜ | MGT-001 | Manager | Google Cloud project + billing | **Business** |
| ⬜ | MGT-002 | Manager | Enable Maps / Geocoding APIs | **Business** |
| ⬜ | MGT-003 | Manager | Create and restrict API keys | **Business** |
| ⬜ | MGT-004 | Manager | Privacy policy (location) | **Business** |
| ⬜ | MGT-005 | Manager | Staff consent / tracking policy | **Business** |
| ⬜ | MGT-006 | Manager | Define subscription plans | **Business** |
| ⬜ | MGT-007 | Manager | ScaleGate license API docs | **Business** |
| ⬜ | MGT-008 | Manager | Map plan codes to features | **Business** |
| ⬜ | MGT-009 | Manager | Customer onboarding flow | **Business** |
| ⬜ | MGT-010 | Manager | Terms of Service + DPA | **Business** |
| ⬜ | MGT-011 | Manager | ERP priority order | **Business** |
| ⬜ | MGT-012 | Manager | SAGE sandbox/SDK | **Business** |
| ⬜ | MGT-013 | Manager | SAP B1 sandbox | **Business** |
| ⬜ | MGT-014 | Manager | QuickBooks developer + OAuth | **Business** |
| ⬜ | MGT-015 | Manager | Tally SDK/docs | **Business** |
| ⬜ | MGT-015b | Manager | Pilot customer for ERP test | **Business** |
| ⬜ | MGT-016 | Manager | Google Play Developer account | **Business** |
| ⬜ | MGT-017 | Manager | Apple Developer Program | **Business** |
| ⬜ | MGT-018 | Manager | Store listings | **Business** |
| ⬜ | MGT-019 | Manager | Play Data safety + content rating | **Business** |
| 🟡 | MGT-020 | Manager | SaaS domain and DNS (api/app live; confirm all records) | **Business** |
| ⬜ | MGT-021 | Manager | Support email / status page | **Business** |
| ⬜ | MGT-022 | Manager | Default geofence radius | **Business** |
| ⬜ | MGT-023 | Manager | Meeting grace + attendance rules | **Business** |

---

## Counts

| Priority | 🟡 In progress | ⬜ Not started | ⏸ Deferred |
|----------|---------------:|---------------:|-----------:|
| **High** (Lite sign-off + WEB-012) | 18 | 28 | 0 |
| **Medium** | 8 | 12 | 0 |
| **Pro** | 0 | 22 | 0 |
| **Enterprise** | 0 | 16 | 0 |
| **Deferred** | 0 | 0 | 4 |
| **Business** (MGT) | 1 | 22 | 0 |

*UT-LITE-004, 007, 008, 009 and E2E-LITE-TIMELINE are ✅ — not listed above.*

---

## How to update

When a task is completed in [PROGRESS_TRACKER.md](./PROGRESS_TRACKER.md), **remove its row** from this file (or change status to ✅ and move to a “Done” archive if you prefer). Keep this file as the **only top-level outstanding list**.
