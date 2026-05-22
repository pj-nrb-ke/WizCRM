# WizCRM

**WizCRM** is an **AI-driven sales operating system** built for [Wise & Agile Solutions Ltd](https://github.com/pj-nrb-ke) (WIZAG). Reps sell; AI captures activity, updates the CRM, recommends next actions, and supports managers—with human approval where it matters.

**Plans:** **Lite** (internal pilot, ~1 week) · **Pro** (mainstream, ~1 month) · **Enterprise** (full platform: field geofence, ERP, advanced integrations).

## Repository

| Item | Value |
|------|--------|
| Local path | `c:\Users\pj\WizCRM` |
| Remote | [github.com/pj-nrb-ke/WizCRM](https://github.com/pj-nrb-ke/WizCRM) |
| Active branch | `development` (day-to-day work; push here) |
| Stable branch | `main` (releases / merges from `development`) |

WizCRM is a **standalone Git repository**. It is not part of the WIZAG public website repo (`WIZAG`); that parent project ignores this folder via `.gitignore`.

## What WizCRM does

- **AI Lead Capture** — Quick add, business card scan, duplicate checks.
- **AI Sales Desk** — Daily priorities: who to call, follow-ups, stale leads.
- **AI Activity Capture** — Post-call logging, voice/quick notes turned into structured timeline entries.
- **AI Follow-up & communication** — Tasks and draft messages (Pro+); you approve before sending.
- **AI Pipeline & manager insight** — Stage suggestions, forecasts, team summaries (Pro+).
- **Field & ERP** — Geofence visit proof and accounting sync (**Enterprise**).

Lead stages and domain rules: **[LEAD_LIFECYCLE.md](./LEAD_LIFECYCLE.md)** (AI suggests stage changes; user confirms).

## Documentation

| Document | Purpose |
|----------|---------|
| **[OUTSTANDING-TASKS.md](./OUTSTANDING-TASKS.md)** | **Single table of all open tasks (top-level)** |
| [SRS.md](./SRS.md) | Software requirements v2.0 (Lite / Pro / Enterprise) |
| [SRS-WEB.md](./SRS-WEB.md) | Web app layer — admin settings, manager desk, phased `WEB-*` |
| [WizCRM Features.md](./WizCRM%20Features.md) | Brochure feature lists by plan |
| [PROGRESS_TRACKER.md](./PROGRESS_TRACKER.md) | Progress by Task ID: `LITE-*`, `UT-*`, `QA-*`, `E2E-*` |
| [manager_tasks.md](./manager_tasks.md) | Non-technical tasks (Google Cloud, ScaleGate, ERP, stores) |
| [manager_task_tracker.md](./manager_task_tracker.md) | Manager checklist (`MGT-*`) |
| [MOBILE_DEV.md](./MOBILE_DEV.md) | Android emulator and Expo |

## Project status

**Lite** development is next (~1 week internal pilot). Mobile has an Expo welcome screen; backend and AI services are not implemented yet. Track work in **PROGRESS_TRACKER.md**.

## Repository layout

```
WizCRM/
├── README.md
├── SRS.md                 # Software requirements v2.0 (AI-first, Lite/Pro/Enterprise)
├── WizCRM Features.md     # Brochure features by plan
├── PROGRESS_TRACKER.md    # Engineering progress by tier
├── manager_tasks.md       # Non-technical prerequisites
├── manager_task_tracker.md
├── LEAD_LIFECYCLE.md
├── MOBILE_DEV.md
├── mobile/                # React Native (Expo)
├── web/                   # Browser app (placeholder)
├── shared/                # Shared types / logic
├── scripts/
└── docker/                # Containers (when stack is chosen)
```

## Development workflow

Work on the **`development`** branch and push to GitHub:

```bash
cd c:\Users\pj\WizCRM
git checkout development
git status
git add .
git commit -m "Describe your change"
git push
```

Merge to `main` when a release is ready:

```bash
git checkout main
git merge development
git push origin main
```

Clone elsewhere:

```bash
git clone https://github.com/pj-nrb-ke/WizCRM.git
cd WizCRM
```

## Docker

There is **no Docker configuration** in this repository yet (`Dockerfile`, `docker-compose.yml`, or similar). There is also **no runnable application** to containerize.

When an application stack and services (app, database, cache, etc.) are added, Docker assets should live under `docker/` or the repo root and be documented in this section with:

- Prerequisites (Docker Desktop or Engine)
- `docker compose up` (or equivalent) for local development
- Environment variables (`.env.example`)

Until then, **no Docker changes are required or possible** beyond placeholder planning.

## Mobile app

WizCRM includes a **mobile app** (Android first, iOS later) alongside the web CRM. The mobile client uses **React Native with Expo** under `mobile/`. Tooling, emulator setup, and run commands are in **[MOBILE_DEV.md](./MOBILE_DEV.md)**.

## Related documentation

- [SRS.md](./SRS.md) — Product and software requirements
- [PROGRESS_TRACKER.md](./PROGRESS_TRACKER.md) — Implementation progress by requirement ID
- [LEAD_LIFECYCLE.md](./LEAD_LIFECYCLE.md) — Lead stages, transitions, and fields to track
- [MOBILE_DEV.md](./MOBILE_DEV.md) — Android Studio, emulator, and mobile development

## License and ownership

Copyright © Wise & Agile Solutions Ltd. Licensing terms to be added when the project moves beyond internal setup.
