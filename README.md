# WizCRM

**WizCRM** is a customer relationship management (CRM) application built for [Wise & Agile Solutions Ltd](https://github.com/pj-nrb-ke) (WIZAG). It is designed to track the **full lifecycle of every lead**—from first contact through qualification, engagement, conversion, and ongoing customer relationship—so sales and operations teams have one place to see status, history, and next actions.

## Repository

| Item | Value |
|------|--------|
| Local path | `c:\Users\pj\WizCRM` |
| Remote | [github.com/pj-nrb-ke/WizCRM](https://github.com/pj-nrb-ke/WizCRM) |
| Active branch | `development` (day-to-day work; push here) |
| Stable branch | `main` (releases / merges from `development`) |

WizCRM is a **standalone Git repository**. It is not part of the WIZAG public website repo (`WIZAG`); that parent project ignores this folder via `.gitignore`.

## What WizCRM does

- **Lead capture** — Record inbound leads (web forms, referrals, manual entry) with source and contact details.
- **Lifecycle tracking** — Move leads through defined stages with timestamps, owners, and notes at each step.
- **Activity history** — Log calls, emails, meetings, and tasks tied to a lead so nothing is lost between handoffs.
- **Pipeline visibility** — See where leads sit in the funnel and which need follow-up.
- **Outcome recording** — Mark leads as won or lost with reasons; convert won leads into accounts for post-sale tracking.

For stage definitions, transitions, and data you should capture at each step, see **[LEAD_LIFECYCLE.md](./LEAD_LIFECYCLE.md)**.

## Project status

The repository is in **early setup**. Application code, API, database schema, and deployment configuration are not yet in the tree. Documentation here describes the **intended product** so development can align on scope before implementation.

## Planned structure (high level)

As the app is built, the repo is expected to grow along these lines:

```
WizCRM/
├── README.md              # This file
├── LEAD_LIFECYCLE.md      # Lead stages and CRM behaviour
├── MOBILE_DEV.md          # Android emulator and mobile toolchain
├── mobile/                # React Native (Expo) app — WizCRM on Android/iOS
├── src/                   # Web / API source (TBD)
├── tests/
└── docker/                # Container definitions (when stack is chosen)
```

Exact folders and technologies will be documented here once the stack is decided (e.g. Node/React, .NET, Python/Django, etc.).

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

- [LEAD_LIFECYCLE.md](./LEAD_LIFECYCLE.md) — Lead stages, transitions, and fields to track
- [MOBILE_DEV.md](./MOBILE_DEV.md) — Android Studio, emulator, and mobile development

## License and ownership

Copyright © Wise & Agile Solutions Ltd. Licensing terms to be added when the project moves beyond internal setup.
