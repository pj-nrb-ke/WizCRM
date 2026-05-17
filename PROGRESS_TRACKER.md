# WizCRM — Progress tracker

Track implementation against **[SRS.md](./SRS.md)**. Update this file as features are completed.

**Legend:** ⬜ Not started · 🟡 In progress · ✅ Done · ⏸ Deferred · ❌ Cancelled

**Last updated:** 2026-05-17

---

## Summary

| Phase | Total | Done | In progress | Not started |
|-------|------:|-----:|------------:|------------:|
| Infrastructure | 4 | 1 | 0 | 3 |
| Phase 1 — MVP | 24 | 0 | 0 | 24 |
| Phase 2 — Field sales | 14 | 0 | 0 | 14 |
| Phase 3 — Geofence | 12 | 0 | 0 | 12 |
| Phase 4 — Scale | 13 | 0 | 0 | 13 |
| Nice-to-have | 35 | 0 | 0 | 35 |
| Non-functional | 9 | 0 | 0 | 9 |

*Counts are manual; update when checking off items.*

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

---

## How to update this file

1. Pick the requirement ID from [SRS.md](./SRS.md).
2. Change status: ⬜ → 🟡 when work starts, → ✅ when acceptance criteria in SRS are met.
3. Add a short note column or bullet under the table row if helpful (PR link, version).
4. Update **Summary** counts and **Last updated** date.
5. Commit on `development` with message e.g. `docs: mark FR-LED-001 complete in progress tracker`.

---

## Related

- [SRS.md](./SRS.md) — Full requirements
- [LEAD_LIFECYCLE.md](./LEAD_LIFECYCLE.md) — Domain reference
- [README.md](./README.md) — Repo overview
