# WizCRM — Outstanding tasks (single list)

**Phase-level status:** **[PHASE-STATUS.md](./PHASE-STATUS.md)**  
**Automated QA:** **[docs/QA-AUTOMATED-SIGNOFF.md](./docs/QA-AUTOMATED-SIGNOFF.md)** — run `.\scripts\run-qa-automated.ps1`  
**Legend:** 🟡 In progress · ⬜ Not started · ✅ Done (removed from list when complete)  
**Last updated:** 2026-05-26

## Product Phase 1 — engineering closeout ✅

All `P1-*` features are implemented. **Device pilot** remains (`QA-LITE-*`).

## P8 Pro — engineering complete ✅

PRO-001 through PRO-013 shipped. Set plan to **Pro** under Platform settings to use new features.

## P11 MGT — engineering deliverables 🟡

Product settings (geofence, grace, support email), **Business checklist** page, and **compliance templates** in `docs/compliance/`. Remaining MGT rows need Legal / IT / Store owners (see `/business`).

---

## Phase snapshot

| Phase | Name | Status |
|-------|------|--------|
| P0 | Production hosting | ✅ |
| P1 | Lite mobile (build) | ✅ — Phase 1 parity on APK (`f1cbf03`) |
| P2 | Lite sign-off | 🟡 — **user device testing only** |
| P3 | Web Cluster A | ✅ |
| P4 | Web Cluster B | ✅ |
| P5 | Web polish (WEB-012) | ✅ |
| P6 | Infrastructure & CI | ✅ |
| P7 | Pro platform | ⬜ |
| P8 | Pro features | 🟡 |
| P9 | Enterprise | ⬜ |
| P10 | Web Cluster D | ⏸ |
| P11 | Business (MGT) | 🟡 |

---

## User testing required (after automated QA passes)

| Status | ID | Task |
|--------|-----|------|
| ⬜ | QA-LITE-PILOT | Device pilot — [MOBILE-PILOT.md](./docs/MOBILE-PILOT.md) |
| ⬜ | QA-LITE-ANDROID | Install **`WizCRM-production.apk`** (`f1cbf03`+); login, lead, note, **close Won/Lost**, **log activity**, reopen, no crash |
| ⬜ | QA-LITE-003 | Business card photo on device |
| ⬜ | QA-LITE-004/007/008 | AI confirm + voice on device |
| ⬜ | QA-NFR-004 | Offline note on device |

All other **QA-LITE-*** and **UT/E2E** are covered by automated tests (see QA-AUTOMATED-SIGNOFF).

---

## Pro / Enterprise / Business (unchanged)

See [PROGRESS_TRACKER.md](./PROGRESS_TRACKER.md) for PRO-*, ENT-*, MGT-* rows.

| Priority | Approx. open rows |
|----------|-------------------|
| Pro | 22 |
| Enterprise | 16 |
| Business (MGT) | 23 |
| Deferred WEB | 4 |

---

## How to update

When user pilot passes, mark P2 ✅ in PHASE-STATUS and clear QA-LITE-PILOT / QA-LITE-ANDROID here.
