# WizCRM

**WizCRM** is an **AI-driven sales operating system** built for [Wise & Agile Solutions Ltd](https://github.com/pj-nrb-ke) (WIZAG). Reps sell; AI captures activity, updates the CRM, recommends next actions, and supports managers — with human approval where it matters.

**Plans:** **Lite** (internal pilot) · **Pro** (mainstream) · **Enterprise** (full platform: field geofence, ERP, advanced integrations).

## Repository

| Item | Value |
|------|--------|
| Local path | `c:\Users\pj\WizCRM` |
| Remote | [github.com/pj-nrb-ke/WizCRM](https://github.com/pj-nrb-ke/WizCRM) |
| Stable branch | `main` (releases) |
| Working branches | `development`, `PJ`, `AK` (day-to-day work; open PRs into these) |

WizCRM is a **standalone Git repository**, not part of the WIZAG public website repo.

## Status at a glance

This is a **working, deployed three-tier product** — API, web console, and mobile app — not a scaffold.

| Tier | Stack | State |
|------|-------|-------|
| **API** | Fastify · Prisma · PostgreSQL · JWT · OpenAI · Brevo | Live at `api.wizcrm.app` |
| **Web** | React 19 · Vite · TypeScript | Live at `app.wizcrm.app` |
| **Mobile** | React Native (Expo) · Android-first | Production APK built & field-tested |
| **Shared** | TypeScript domain logic · Zod | Used by all tiers |

**Where the programme is:**

- **Product Phase 1 (core CRM)** — ✅ engineering complete across web, mobile, and API. Remaining gate: mobile **device pilot** sign-off.
- **Pro features** (AI capture, desk, forecasting, quotations, branding) — ✅ built.
- **Pro platform (multi-tenancy / `tenant_id`)** — ⬜ not started; the main gap between internal pilot and external SaaS.
- **Enterprise** (field geofence, real ERP connectors, SSO) — ⬜ stubs only.

Authoritative status lives in the trackers below — **start with [PHASE-STATUS.md](./PHASE-STATUS.md)**.

## What WizCRM does

- **AI Lead Capture** — quick add, business-card scan, duplicate checks.
- **AI Sales Desk** — daily priorities: who to call, follow-ups, stale leads.
- **AI Activity Capture** — post-call logging; voice/quick notes turned into structured timeline entries.
- **AI Follow-up & communication** — tasks and draft messages (Pro+); you approve before sending.
- **AI Pipeline & manager insight** — stage suggestions, forecasts, team summaries (Pro+).
- **Field & ERP** — geofence visit proof and accounting sync (**Enterprise**).

Lead stages and domain rules: **[LEAD_LIFECYCLE.md](./LEAD_LIFECYCLE.md)** (AI suggests stage changes; user confirms).

## Documentation

| Document | Purpose |
|----------|---------|
| **[PHASE-STATUS.md](./PHASE-STATUS.md)** | **Phase-level status (P0–P11) — read this first** |
| [OUTSTANDING-TASKS.md](./OUTSTANDING-TASKS.md) | Single table of all open tasks |
| [PROGRESS_TRACKER.md](./PROGRESS_TRACKER.md) | Progress by Task ID: `LITE-*`, `PRO-*`, `WEB-*`, `QA-*` |
| [docs/WEB-MOBILE-GAP-ANALYSIS.md](./docs/WEB-MOBILE-GAP-ANALYSIS.md) | Web ↔ mobile feature parity (`MOB-GAP-*`) |
| [SRS.md](./SRS.md) | Software requirements v2.x (Lite / Pro / Enterprise) |
| [SRS-WEB.md](./SRS-WEB.md) | Web app layer — admin settings, manager desk, phased `WEB-*` |
| [WizCRM Features.md](./WizCRM%20Features.md) | Brochure feature lists by plan |
| [MOBILE_DEV.md](./MOBILE_DEV.md) | Android emulator and Expo toolchain |
| [docs/MOBILE-PILOT.md](./docs/MOBILE-PILOT.md) | Production pilot checklist (5 min) |
| [docs/QA-AUTOMATED-SIGNOFF.md](./docs/QA-AUTOMATED-SIGNOFF.md) | Engineering QA gate |

## Repository layout

```
WizCRM/
├── api/        # Fastify + Prisma backend (PostgreSQL, JWT, OpenAI, Brevo)
│   ├── src/    # routes/ + services/
│   └── prisma/ # schema.prisma (db push workflow — no migrations dir)
├── web/        # React + Vite manager/admin console + public landing page
├── mobile/     # React Native (Expo) app — Android-first
├── shared/     # Shared TypeScript types + domain logic (Zod schemas)
├── docker/     # docker-compose.yml (dev) + docker-compose.prod.yml
├── scripts/    # QA, build-apk, and test automation (PowerShell)
└── docs/       # QA, compliance, hosting, gap analysis
```

## Getting started (local dev)

Prerequisites: Node.js, a PostgreSQL database (or `docker compose -f docker/docker-compose.yml up -d`), and an `api/.env` (copy from `.env.example`).

```bash
npm install                 # install workspaces (shared, api, web)

# API
npm run db:up               # start Postgres via docker (optional)
npm run api:dev             # tsx watch on the Fastify server

# Web
npm run web:dev             # Vite dev server (http://localhost:5180)

# Mobile — see MOBILE_DEV.md
```

`api/.env` must set at least `DATABASE_URL` and `JWT_SECRET` (required; no safe default). `OPENAI_API_KEY` and Brevo keys are optional — AI/email features degrade gracefully without them.

## Tests & CI

```bash
npm test                    # shared + api + mobile unit/integration
npm run web:build           # type-check + production build of the web app
npm run test:qa             # automated engineering QA gate (PowerShell)
```

CI runs on push/PR via **[.github/workflows/test.yml](./.github/workflows/test.yml)** (unit + integration jobs).

## Deployment

The API and web app run on a VPS behind `api.wizcrm.app` and `app.wizcrm.app`. Production container assets live in [`docker/docker-compose.prod.yml`](./docker/docker-compose.prod.yml); hosting notes are in [docs/HOSTING-WEB-SERVER.md](./docs/HOSTING-WEB-SERVER.md). The mobile production APK is built with `.\scripts\build-apk.ps1 -Production` (see [MOBILE_DEV.md](./MOBILE_DEV.md)).

## Development workflow

```bash
git checkout -b feat/my-change      # branch from a working branch
git commit -m "Describe your change"
git push -u origin feat/my-change   # open a PR into development / PJ
```

Merge to `main` when a release is ready.

## License and ownership

Copyright © Wise & Agile Solutions Ltd. Licensing terms to be added when the project moves beyond internal setup.
