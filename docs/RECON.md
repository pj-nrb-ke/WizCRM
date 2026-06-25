# Lead Generator — Recon (Phase 0)

**Branch:** `feature/lead-engine`
**Date:** 2026-06-25

## Stack confirmed

| Layer | Detail |
|---|---|
| Backend | Fastify 5, TypeScript, ESM modules |
| ORM | Prisma 6 — `db push` workflow (no migration files) |
| Database | PostgreSQL 16 (Docker on port 5434) |
| Auth | JWT HS256, 7-day expiry, `app.authenticate` hook on every protected route |
| API conventions | `FastifyPluginAsync`, registered in `app.ts` with a prefix; `request.user` has `{ id, organizationId, role }` |
| Frontend | React 19, Vite, React Router 7 |
| Email | Brevo — API key (`xkeysib-*`) or SMTP fallback, loaded from `brevo.local.txt` or env |
| Background jobs | None currently — enrichment/discovery will use in-process async queues (simple Map + setImmediate pattern) |

## Existing pipeline model

- **Lead** table is the main entity. Stages: `NEW → CONTACTED → QUALIFIED → PROPOSAL → NEGOTIATION → WON/LOST`.
- **SalesOpportunity** links to a Lead and tracks deal stage/value separately.
- Import action: create a `Lead` record (stage = `NEW`, source = `lead_generator`) then optionally a `SalesOpportunity` — this feeds the existing pipeline with zero schema changes.

## Data model fit

New models added in Phase 1:
- `Campaign` — the unit of lead generation
- `DiscoveryRun` — tracks one async discovery job per campaign
- `Prospect` — a discovered company (pre-import)
- `ProspectContact` — contacts found via enrichment
- `ProspectEnrichment` — website crawl results, ERP signals, size estimate
- `EmailTemplate` — reusable email bodies with merge fields
- `EmailSequence` — links templates to a campaign as a 3-step sequence
- `EmailSend` — per-prospect per-step send record with engagement timestamps
- `SuppressionList` — do-not-contact entries per org

All scoped to `organizationId`. Prospect → Lead import creates a standard `Lead` row.

## Background job approach

No Celery/BullMQ installed. Will use a lightweight in-process job map:
- Discovery: `POST /leadengine/campaigns/:id/discover` starts async job, returns `runId` immediately
- UI polls `GET /leadengine/runs/:runId` for status
- Enrichment: same pattern per prospect
- Sequence scheduling: store `scheduledAt` on `EmailSend`, a polling interval (every minute) checks and fires due sends

This avoids adding a job queue dependency for v1 and fits the existing Fastify architecture.

## API plan fit

New route prefix: `/leadengine` — registered in `app.ts` alongside existing routes.
Auth: same `app.authenticate` hook. Role checks: any authenticated user can run discovery; only MANAGER/ADMIN can manage campaigns (same pattern as existing `requireManager()`).

## Brevo Campaign API

Key confirmed in `.env` as `BREVO_CAMPAIGN_API_KEY` (same value as `BREVO_API_KEY`).
Will use Brevo's `/v3/emailCampaigns` API for bulk sends with open/click tracking, and `/v3/webhooks` for reply/unsubscribe events.

## Google Places API

Key needed in `.env` as `GOOGLE_PLACES_API_KEY`. When not set, discovery falls back to a stub returning empty results with a clear error message — system still starts normally.

## No blockers — proceeding to Phase 2.
