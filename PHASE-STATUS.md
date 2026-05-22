# WizCRM — Phase status (top-level)

Single view of **where the programme is by phase**. Task-level detail: [OUTSTANDING-TASKS.md](./OUTSTANDING-TASKS.md) · Full tracker: [PROGRESS_TRACKER.md](./PROGRESS_TRACKER.md)

**Last updated:** 2026-05-22

| Phase | Name | Status | Delivered / live today | Remaining to close phase |
|-------|------|--------|-------------------------|---------------------------|
| **P0** | **Production hosting** | ✅ **Done** | VPS, `api.wizcrm.app`, `app.wizcrm.app`, deploy, Brevo email on server | — |
| **P1** | **Lite mobile (build)** | ✅ **Done** | Feature-complete APK; Lite+ Pro; email send API | — |
| **P2** | **Lite sign-off (quality)** | 🟡 **Engineering QA done** | All UT/E2E + [QA-AUTOMATED-SIGNOFF.md](./docs/QA-AUTOMATED-SIGNOFF.md) | **User:** [MOBILE-PILOT.md](./MOBILE-PILOT.md) only |
| **P3** | **Web — Cluster A (admin)** | ✅ **Done** | Login, org, users, platform, connection, audit | — |
| **P4** | **Web — Cluster B (manager)** | ✅ **Done** | Manager home, pipeline, leads, reports/CSV | — |
| **P5** | **Web — polish** | ✅ **Done** | **WEB-012** teams CRUD on web + integration tests | — |
| **P6** | **Infrastructure & CI** | ✅ **Done** | GitHub Actions, integration smoke, `run-qa-automated.ps1` | — |
| **P7** | **Pro platform (Cluster C)** | ⬜ **Not started** | — | Multi-tenant, ScaleGate |
| **P8** | **Pro product features** | 🟡 **In progress** | PRO slice on mobile/API | Full PRO-004–013 |
| **P9** | **Enterprise** | ⬜ **Not started** | — | ENT-* |
| **P10** | **Web — Cluster D (sales parity)** | ⏸ **Deferred** | — | WEB-030–033 |
| **P11** | **Business & compliance (MGT)** | 🟡 **In progress** | MGT-020 DNS/hosting | Stores, legal, ERP |

---

## Engineering QA gate (before your device testing)

```powershell
.\scripts\run-qa-automated.ps1
```

Document: [docs/QA-AUTOMATED-SIGNOFF.md](./docs/QA-AUTOMATED-SIGNOFF.md)

**Your turn after green:** QA-LITE-ANDROID + QA-LITE-PILOT ([MOBILE-PILOT.md](./docs/MOBILE-PILOT.md)).

---

## Quick counts (open tasks)

| Bucket | Approx. open |
|--------|----------------|
| User device QA (P2 closeout) | 2 |
| Pro / Enterprise | 38+ |
| Business (MGT) | 23 |
