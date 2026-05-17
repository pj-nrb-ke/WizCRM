# WizCRM — Progress tracker

Track implementation against **[SRS.md](./SRS.md)**. Update this file as features are completed.

**Legend:** ⬜ Not started · 🟡 In progress · ✅ Done · ⏸ Deferred · ❌ Cancelled

**Last updated:** 2026-05-17 (SRS v1.2)

**Manager (non-technical) tasks:** [manager_task_tracker.md](./manager_task_tracker.md) (`MGT-*`)

---

## Summary

| Phase | Total | Done | In progress | Not started |
|-------|------:|-----:|------------:|------------:|
| Technical add-ons (TOOL-*) | 12 | 0 | 0 | 12 |
| Infrastructure | 7 | 3 | 0 | 4 |
| Phase 1 — MVP | 24 | 0 | 0 | 24 |
| Phase 2 — Field sales | 14 | 0 | 0 | 14 |
| Phase 3 — Geofence | 12 | 0 | 0 | 12 |
| Phase 4 — Scale | 13 | 0 | 0 | 13 |
| Phase 5 — Multi-tenant SaaS | 17 | 0 | 0 | 17 |
| Phase 5 — ScaleGate licensing | 14 | 0 | 0 | 14 |
| Phase 6 — ERP integrations | 24 | 0 | 0 | 24 |
| Nice-to-have | 35 | 0 | 0 | 35 |
| Non-functional | 11 | 0 | 0 | 11 |

*Counts are manual; update when checking off items.*

---

## Technical add-ons and integrations (TOOL-*)

Install when the related feature slice starts. Details in [SRS.md](./SRS.md) §20.

| Status | ID | Package / service | Blocks on (manager) |
|--------|-----|-------------------|---------------------|
| ⬜ | TOOL-001 | `expo-maps` or `react-native-maps` + config plugin | MGT-001–003 |
| ⬜ | TOOL-002 | Google Geocoding API (or Mapbox) | MGT-001–003 |
| ⬜ | TOOL-003 | `expo-location` + `expo-task-manager` (geofence) | MGT-001–005 |
| ⬜ | TOOL-004 | Map API keys in app / EAS secrets | MGT-003 |
| ⬜ | TOOL-005 | `expo-notifications` + FCM / APNs | MGT-016–017 |
| ⬜ | TOOL-006 | `expo-secure-store` | — |
| ⬜ | TOOL-007 | Call detection (Android; evaluate library) | MGT-019 |
| ⬜ | TOOL-008 | `eas-cli` + EAS production builds | MGT-016–017 |
| ⬜ | TOOL-009 | Web maps (Maps JS API or Mapbox) | MGT-001–003 |
| ⬜ | TOOL-010 | ScaleGate `LicenseService` HTTP client | MGT-007–008 |
| ⬜ | TOOL-011 | `integrations/erp/` vendor adapters | MGT-012–015 |
| ⬜ | TOOL-012 | Sentry (or error monitoring) | Optional |

---

## Infrastructure (repo / tooling)

| Status | ID | Item | Notes |
|--------|-----|------|-------|
| ✅ | INF-001 | Git repo + `development` branch | |
| ✅ | INF-002 | Expo mobile scaffold (`mobile/`) | Welcome screen only |
| ✅ | INF-003 | Folder layout `web/`, `shared/`, `docker/` | Placeholders |
| ⬜ | INF-004 | Backend API + database | Stack TBD |
| ⬜ | INF-005 | Web app scaffold | |
| ⬜ | INF-006 | CI (lint/test/build) | |
| ⬜ | INF-007 | Docker compose local dev | |
| ⬜ | INF-008 | `tenant_id` on all tenant tables (schema provision) | |
| ⬜ | INF-009 | `LicenseService` abstraction + dev mock (ScaleGate) | |
| ⬜ | INF-010 | `integrations/erp/` stub adapters + DB tables provision | |

---

## Phase 1 — MVP

### Foundation

| Status | ID | Requirement |
|--------|-----|-------------|
| ⬜ | FR-FND-001 | Authentication (sign in / out) |
| ⬜ | FR-FND-002 | Authorization roles (Sales, Manager, Admin) |
| ⬜ | FR-FND-003 | User profile |
| ⬜ | FR-FND-004 | Shared API contract + `shared/` types |
| ⬜ | FR-FND-005 | Audit log |
| ⬜ | FR-FND-006 | Mobile offline (basic) |

### Leads and lifecycle

| Status | ID | Requirement |
|--------|-----|-------------|
| ⬜ | FR-LED-001 | Create lead |
| ⬜ | FR-LED-002 | Lead list (search, filter, sort) |
| ⬜ | FR-LED-003 | Lead detail |
| ⬜ | FR-LED-004 | Edit / delete (archive) lead |
| ⬜ | FR-LED-005 | Duplicate detection |
| ⬜ | FR-LED-006 | Assign / reassign owner |
| ⬜ | FR-LED-007 | Stage change + history |
| ⬜ | FR-LED-008 | Pipeline view |
| ⬜ | FR-LED-009 | Close Won |
| ⬜ | FR-LED-010 | Close Lost (with reasons) |
| ⬜ | FR-LED-011 | Reopen lost lead |
| ⬜ | FR-LED-012 | Stale leads highlight |
| ⬜ | FR-LED-013 | Configurable stages (admin) |

### Activities

| Status | ID | Requirement |
|--------|-----|-------------|
| ⬜ | FR-ACT-001 | Timeline per lead |
| ⬜ | FR-ACT-002 | Activity types (call, email, meeting, task, note) |
| ⬜ | FR-ACT-003 | Log call (manual) |
| ⬜ | FR-ACT-004 | Log email |
| ⬜ | FR-ACT-005 | Log meeting (schedule only; no geofence) |
| ⬜ | FR-ACT-006 | Tasks / reminders |
| ⬜ | FR-ACT-007 | Notes |
| ⬜ | FR-ACT-008 | Next action on lead |

---

## Phase 2 — Field sales

### Post-call lead attachment

| Status | ID | Requirement |
|--------|-----|-------------|
| ⬜ | FR-CAL-001 | Post-call prompt epic |
| ⬜ | FR-CAL-001a | Trigger: outbound from app |
| ⬜ | FR-CAL-001b | Trigger: return to app after call |
| ⬜ | FR-CAL-001c | Trigger: call log (Android) |
| ⬜ | FR-CAL-001d | Manual “Log recent call” |
| ⬜ | FR-CAL-002 | Unlinked calls dashboard widget |
| ⬜ | FR-CAL-003 | Calls logged vs detected report |

### Mobile and notifications

| Status | ID | Requirement |
|--------|-----|-------------|
| ⬜ | FR-MOB-001 | Push notifications |
| ⬜ | FR-MOB-002 | Tap-to-call / email |
| ⬜ | FR-MOB-003 | Add lead from mobile |
| ⬜ | FR-MOB-005 | Compact pipeline view |
| ⬜ | FR-NOT-001 | Task due notifications *(referenced in SRS)* |

### Reporting (initial)

| Status | ID | Requirement |
|--------|-----|-------------|
| ⬜ | FR-RPT-001 | My dashboard |
| ⬜ | FR-RPT-002 | Manager dashboard (basic) |

---

## Phase 3 — Meeting geofence attendance

| Status | ID | Requirement |
|--------|-----|-------------|
| ⬜ | FR-GEO-001 | Meeting with location + geofence epic |
| ⬜ | FR-GEO-001a | Map pick location (web + mobile) |
| ⬜ | FR-GEO-001b | Navigate to destination |
| ⬜ | FR-GEO-002 | Enter/exit debouncing |
| ⬜ | FR-GEO-003 | Manual override (manager) |
| ⬜ | FR-GEO-004 | Location consent + privacy UX |
| ⬜ | FR-GEO-005 | Meeting attendance report |
| ⬜ | FR-GEO-006 | Export attendance CSV |
| ⬜ | FR-ACT-005+ | Meeting + geofence registration on device |

---

## Phase 4 — Scale (web admin, reporting, integrations)

| Status | ID | Requirement |
|--------|-----|-------------|
| ⬜ | FR-WEB-001 | Bulk CSV import |
| ⬜ | FR-WEB-002 | Bulk assign / stage change |
| ⬜ | FR-WEB-003 | Users and teams |
| ⬜ | FR-WEB-004 | Sources, stages, loss reasons |
| ⬜ | FR-WEB-005 | Custom fields |
| ⬜ | FR-WEB-006 | System settings (stale, geofence X, call prompts) |
| ⬜ | FR-RPT-003 | Conversion metrics |
| ⬜ | FR-RPT-004 | Time in stage |
| ⬜ | FR-RPT-005 | Win/loss analytics |
| ⬜ | FR-RPT-006 | Export CSV |
| ⬜ | FR-RPT-007 | Saved views |
| ⬜ | FR-INT-001 | Web form → lead |
| ⬜ | FR-INT-002 | Email sync |
| ⬜ | FR-INT-003 | Calendar sync |
| ⬜ | FR-INT-004 | Webhooks |
| ⬜ | FR-INT-005 | Rule engine |
| ⬜ | FR-INT-006 | Slack / Teams |
| ⬜ | FR-ACC-001 | Convert to Account |
| ⬜ | FR-ACC-002 | Account timeline |
| ⬜ | FR-ACC-003 | Renewal / upsell |

---

## Phase 5 — Multi-tenant SaaS

| Status | ID | Requirement |
|--------|-----|-------------|
| ⬜ | FR-MT-001 | `tenant_id` on all business entities |
| ⬜ | FR-MT-002 | Query isolation by tenant (API + DB) |
| ⬜ | FR-MT-003 | No cross-tenant access (except platform admin) |
| ⬜ | FR-MT-004 | Tenant record (slug, status, timezone, currency) |
| ⬜ | FR-MT-005 | Web tenant routing (subdomain/slug) |
| ⬜ | FR-MT-006 | Mobile tenant context from login |
| ⬜ | FR-MT-007 | Tenant provisioning + first admin |
| ⬜ | FR-MT-008 | Suspend tenant on invalid license |
| ⬜ | FR-MT-009 | Per-tenant CRM settings and branding |
| ⬜ | FR-MT-010 | Per-tenant ERP connector config |
| ⬜ | FR-MT-011 | Feature flags from ScaleGate plan |
| ⬜ | FR-MT-012 | User multi-tenant membership + switcher |
| ⬜ | FR-MT-013 | Roles scoped per tenant |
| ⬜ | FR-MT-014 | Seat limit enforcement |
| ⬜ | FR-MT-015 | Tenant data export |
| ⬜ | FR-MT-016 | Tenant delete / purge workflow |
| ⬜ | FR-MT-017 | Usage metering hooks (ScaleGate) |

---

## Phase 5 — ScaleGate commercial licensing

| Status | ID | Requirement |
|--------|-----|-------------|
| ⬜ | FR-SG-001 | ScaleGate as license system of record |
| ⬜ | FR-SG-002 | Validate license on login / schedule |
| ⬜ | FR-SG-003 | Cache validation result locally |
| ⬜ | FR-SG-004 | Map plan codes to feature flags |
| ⬜ | FR-SG-005 | Web block/renewal on invalid license |
| ⬜ | FR-SG-006 | Mobile license check + cache TTL |
| ⬜ | FR-SG-007 | API middleware on invalid license |
| ⬜ | FR-SG-008 | Background re-validation job |
| ⬜ | FR-SG-009 | Grace period + read-only mode |
| ⬜ | FR-SG-010 | Mobile offline entitlement cache |
| ⬜ | FR-SG-011 | Admin license status UI + portal link |
| ⬜ | FR-SG-012 | ScaleGate secrets in env / vault |
| ⬜ | FR-SG-013 | mTLS / signed requests (if required) |
| ⬜ | FR-SG-014 | Safe license check logging |

---

## Phase 6 — ERP and accounting integrations

| Status | ID | Requirement |
|--------|-----|-------------|
| ⬜ | FR-ERP-001 | ErpConnector framework |
| ⬜ | FR-ERP-002 | One active connector per tenant (v1) |
| ⬜ | FR-ERP-003 | Connector registry in admin UI |
| ⬜ | FR-ERP-010 | Customer entity mapping + external_id |
| ⬜ | FR-ERP-011 | Push customer to ERP |
| ⬜ | FR-ERP-012 | Pull customers from ERP |
| ⬜ | FR-ERP-013 | Bidirectional field mapping config |
| ⬜ | FR-ERP-014 | Conflict resolution policy |
| ⬜ | FR-ERP-015 | Duplicate prevention |
| ⬜ | FR-ERP-020 | Quotations in WizCRM (header + lines) |
| ⬜ | FR-ERP-021 | Push quotation to ERP |
| ⬜ | FR-ERP-022 | Store ERP quote id and status |
| ⬜ | FR-ERP-023 | Pull quote status from ERP |
| ⬜ | FR-ERP-024 | Link quote to lead + ERP customer |
| ⬜ | FR-ERP-025 | PDF / authoritative doc policy |
| ⬜ | FR-ERP-030 | Scheduled sync |
| ⬜ | FR-ERP-031 | Manual sync |
| ⬜ | FR-ERP-032 | Sync job queue + retries |
| ⬜ | FR-ERP-033 | Sync audit log |
| ⬜ | FR-ERP-034 | Admin alert on sync failure |
| ⬜ | FR-ERP-040 | Encrypted ERP credentials vault |
| ⬜ | FR-ERP-041 | Test connection |
| ⬜ | FR-ERP-042 | OAuth refresh (QuickBooks etc.) |
| ⬜ | FR-ERP-043 | Disable sync without `erp_sync` license |
| ⬜ | FR-ERP-050 | ERP item catalog cache (optional) |
| ⬜ | FR-ERP-051 | Price list refresh (optional) |
| ⬜ | FR-ERP-060 | Stub adapters: SAGE, SAP B1, QB, Tally |
| ⬜ | FR-ERP-061 | ERP webhook endpoint provision |
| ⬜ | FR-ERP-062 | DB tables: connections, links, quotes, logs |

### ERP connectors (implement when SDK/API provided)

| Status | System | Notes |
|--------|--------|-------|
| ⬜ | ERP-SAGE | SAGE Evolution 200 |
| ⬜ | ERP-SAPB1 | SAP Business One |
| ⬜ | ERP-QB | QuickBooks |
| ⬜ | ERP-TALLY | Tally / TallyPrime |

---

## Nice-to-have (FR-NTH-*)

| Status | ID | Feature |
|--------|-----|---------|
| ⬜ | FR-NTH-001 | Dark / light theme |
| ⬜ | FR-NTH-002 | Customizable home |
| ⬜ | FR-NTH-003 | Pinned leads |
| ⬜ | FR-NTH-004 | Recent searches |
| ⬜ | FR-NTH-005 | Haptic feedback |
| ⬜ | FR-NTH-006 | Accessibility (WCAG) |
| ⬜ | FR-NTH-010 | @mention in notes |
| ⬜ | FR-NTH-011 | Lead thread chat |
| ⬜ | FR-NTH-012 | Handoff checklist |
| ⬜ | FR-NTH-013 | Shared team views |
| ⬜ | FR-NTH-014 | Activity feed |
| ⬜ | FR-NTH-020 | File attachments |
| ⬜ | FR-NTH-021 | Document templates |
| ⬜ | FR-NTH-022 | E-signature integration |
| ⬜ | FR-NTH-023 | Business card scan |
| ⬜ | FR-NTH-030 | Email templates |
| ⬜ | FR-NTH-031 | SMS / WhatsApp log |
| ⬜ | FR-NTH-032 | Voicemail link |
| ⬜ | FR-NTH-040 | Timeline summary (AI) |
| ⬜ | FR-NTH-041 | Suggested next action |
| ⬜ | FR-NTH-042 | Lead scoring |
| ⬜ | FR-NTH-043 | Sentiment on notes |
| ⬜ | FR-NTH-044 | Voice note → activity |
| ⬜ | FR-NTH-050 | Snooze lead |
| ⬜ | FR-NTH-051 | Web keyboard shortcuts |
| ⬜ | FR-NTH-052 | Calendar week view |
| ⬜ | FR-NTH-053 | Working hours DND |
| ⬜ | FR-NTH-060 | Contact sync |
| ⬜ | FR-NTH-061 | Accounting export |
| ⬜ | FR-NTH-062 | Marketing handoff |
| ⬜ | FR-NTH-070 | Report builder |
| ⬜ | FR-NTH-071 | Scheduled email reports |
| ⬜ | FR-NTH-072 | Quotas and goals |
| ⬜ | FR-NTH-073 | Weighted forecast |
| ⬜ | FR-NTH-080 | Home screen widget |
| ⬜ | FR-NTH-081 | Wear OS / Watch |
| ⬜ | FR-NTH-082 | Share lead PDF |
| ⬜ | FR-NTH-083 | Driving mode |
| ⬜ | FR-NTH-084 | Arrival photo |
| ⬜ | FR-NTH-090 | SSO SAML/OIDC |
| ⬜ | FR-NTH-091 | 2FA TOTP |
| ⬜ | FR-NTH-092 | IP allowlist |
| ⬜ | FR-NTH-093 | Data retention job |
| ⬜ | FR-NTH-094 | Encrypt sensitive notes |
| ⬜ | FR-NTH-100 | Leaderboard |
| ⬜ | FR-NTH-101 | Badges |
| ⬜ | FR-NTH-110 | Map draw geofence (web) |
| ⬜ | FR-NTH-111 | Visitor log export |
| ⬜ | FR-MOB-004 | Biometric unlock |

---

## Non-functional requirements

| Status | ID | Requirement |
|--------|-----|-------------|
| ⬜ | NFR-001 | Availability target |
| ⬜ | NFR-002 | List performance p95 |
| ⬜ | NFR-003 | Security baseline |
| ⬜ | NFR-004 | GDPR export/delete |
| ⬜ | NFR-005 | Mobile battery (geofence) |
| ⬜ | NFR-006 | Multi-tenant-ready schema |
| ⬜ | NFR-007 | Observability |
| ⬜ | NFR-008 | i18n-ready strings |
| ⬜ | NFR-009 | Mobile accessibility |
| ⬜ | NFR-010 | ScaleGate graceful degradation |
| ⬜ | NFR-011 | ERP async sync / idempotent jobs |

---

## How to update this file

1. Pick the requirement ID from [SRS.md](./SRS.md).
2. Change status: ⬜ → 🟡 when work starts, → ✅ when acceptance criteria in SRS are met.
3. Add a short note column or bullet under the table row if helpful (PR link, version).
4. Update **Summary** counts and **Last updated** date.
5. Commit on `development` with message e.g. `docs: mark FR-LED-001 complete in progress tracker`.

---

## Related

- [SRS.md](./SRS.md) — Full requirements (§20 TOOL-*, §21 MGT-*)
- [manager_tasks.md](./manager_tasks.md) — Non-technical task descriptions
- [manager_task_tracker.md](./manager_task_tracker.md) — Manager checklist (`MGT-*`)
- [LEAD_LIFECYCLE.md](./LEAD_LIFECYCLE.md) — Domain reference
- [README.md](./README.md) — Repo overview
