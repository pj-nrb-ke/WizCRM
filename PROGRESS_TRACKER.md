# WizCRM — Progress tracker

Track implementation against **[SRS.md](./SRS.md) v2.0** (AI-first, **Lite / Pro / Enterprise**).

**Legend:** ⬜ Not started · 🟡 In progress · ✅ Done · ⏸ Deferred · ❌ Cancelled

**Last updated:** 2026-05-17 (SRS v2.0)

**Manager tasks:** [manager_task_tracker.md](./manager_task_tracker.md) (`MGT-*`)

---

## Summary

| Phase | Target | Total | Done | In progress | Not started |
|-------|--------|------:|-----:|------------:|------------:|
| Infrastructure | — | 8 | 3 | 0 | 5 |
| **Lite** (~1 week) | Internal pilot | 14 | 0 | 0 | 14 |
| **Pro** (~1 month) | Mainstream | 15 | 0 | 0 | 15 |
| **Enterprise** | Full platform | 12 | 0 | 0 | 12 |
| Technical add-ons | — | 10 | 0 | 0 | 10 |
| ScaleGate | Pro+ | 5 | 0 | 0 | 5 |
| Non-functional | — | 8 | 0 | 0 | 8 |

*Update counts when checking off items.*

---

## Infrastructure

| Status | ID | Item | Tier |
|--------|-----|------|------|
| ✅ | INF-001 | Git repo + `development` branch | All |
| ✅ | INF-002 | Expo mobile scaffold | All |
| ✅ | INF-003 | Folder layout `web/`, `shared/`, `docker/` | All |
| ⬜ | INF-004 | Backend API + database | Lite+ |
| ⬜ | INF-005 | AI orchestration / LLM service layer | Lite+ |
| ⬜ | INF-006 | Web app scaffold | Pro+ |
| ⬜ | INF-007 | CI (lint/test/build) | Pro+ |
| ⬜ | INF-008 | `tenant_id` schema (design for Pro) | Pro+ |

---

## WizCRM Lite (~1 week, internal)

| Status | ID | Feature |
|--------|-----|---------|
| ⬜ | LITE-001 | Lead Inbox (minimal fields) |
| ⬜ | LITE-002 | Duplicate detection |
| ⬜ | LITE-003 | Business card capture |
| ⬜ | LITE-004 | Lifecycle stages + AI suggest / user confirm |
| ⬜ | LITE-005 | AI Sales Desk (basic) |
| ⬜ | LITE-006 | AI Lead Summary |
| ⬜ | LITE-007 | AI Next Action |
| ⬜ | LITE-008 | Quick note + voice → AI timeline |
| ⬜ | LITE-009 | Post-call prompt (Android) |
| ⬜ | LITE-010 | Activity timeline |
| ⬜ | LITE-011 | Follow-up tasks |
| ⬜ | LITE-012 | Simple pipeline by stage |
| ⬜ | LITE-013 | Auth (single org, internal) |
| ⬜ | LITE-014 | Mobile-first delivery |

---

## WizCRM Pro (~1 month)

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

---

## WizCRM Enterprise

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
| ⬜ | TOOL-001 | LLM / AI orchestration | ● | ● | ● |
| ⬜ | TOOL-002 | Card scan (camera + OCR/vision) | ● | ● | ● |
| ⬜ | TOOL-003 | `expo-secure-store` | ● | ● | ● |
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

1. Complete work against `LITE-*` / `PRO-*` / `ENT-*` in [SRS.md](./SRS.md).
2. Mark status here; update **Summary** counts.
3. Commit on `development`: `docs: mark LITE-003 complete`.

---

## Related

- [SRS.md](./SRS.md) — Requirements v2.0  
- [WizCRM Features.md](./WizCRM%20Features.md) — Brochure by tier  
- [manager_task_tracker.md](./manager_task_tracker.md) — `MGT-*`  
- [MOBILE_DEV.md](./MOBILE_DEV.md) — Mobile toolchain
