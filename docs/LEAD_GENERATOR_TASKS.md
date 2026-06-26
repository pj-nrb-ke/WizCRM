# Lead Generator — Task Tracker

**Feature branch:** `feature/lead-engine`
**Status:** In Progress
**Last updated:** 2026-06-25

---

## Phase 0 — Recon & Branch Setup ✅ COMPLETE
- [x] Create `feature/lead-engine` branch off main
- [x] Document existing Leads/Pipeline data model
- [x] Confirm Brevo transactional setup works
- [x] Confirm Google Places API key available
- [x] Produce `RECON.md`

---

## Phase 1 — Data Model & Foundation ✅ COMPLETE
- [x] Add `Campaign` table
- [x] Add `Prospect` table
- [x] Add `ProspectContact` table
- [x] Add `ProspectEnrichment` table
- [x] Add `EmailTemplate` table
- [x] Add `EmailSequence` table
- [x] Add `EmailSend` table
- [x] Add `SuppressionList` table
- [x] Run Prisma db push and verify schema
- [x] Default scoring rules built into campaign service

---

## Phase 2 — Campaign Manager (API) ✅ COMPLETE
- [x] `GET /leadengine/campaigns` — list all campaigns
- [x] `POST /leadengine/campaigns` — create campaign
- [x] `GET /leadengine/campaigns/:id` — campaign detail + stats
- [x] `PUT /leadengine/campaigns/:id` — update campaign
- [x] `DELETE /leadengine/campaigns/:id` — archive (soft close)
- [x] Campaign status transitions: Draft → Active → Paused → Closed

---

## Phase 3 — AI Prospect Discovery (API) ✅ COMPLETE
- [x] Provider abstraction layer (`DiscoveryProvider` interface)
- [x] Google Places API provider (Text Search v1)
- [x] Manual prospect add: `POST /leadengine/campaigns/:id/prospects`
- [x] Discovery endpoint: `POST /leadengine/campaigns/:id/discover` (async)
- [x] Discovery run status: `GET /leadengine/runs/:runId`
- [x] Deduplication (hash of normalised name + locality + phone)
- [x] Suppression list checked before every insert
- [x] 350ms per-query rate limit between Google Places calls

---

## Phase 4 — AI Scoring Engine (API) ✅ COMPLETE
- [x] Scoring service — reads `scoringRules` from campaign
- [x] Keyword + built-in signal detection
- [x] Tier assignment: A ≥ 60, B 35–59, C 15–34, drop < 15
- [x] Score breakdown stored per prospect
- [ ] Re-score endpoint: `POST /leadengine/campaigns/:id/score` ← small gap

---

## Phase 5 — AI Contact Enrichment (API) ⬜ NOT STARTED
- [ ] `EnrichmentProvider` interface
- [ ] Default provider: crawl company website (About/Team/Contact pages)
- [ ] Email pattern guessing + MX/SMTP verification
- [ ] Async enrichment job
- [ ] `POST /leadengine/prospects/:id/enrich`
- [ ] Provenance stored (source + timestamp) on every datapoint
- [ ] Result saved to `ProspectEnrichment` table

---

## Phase 6 — Email Outreach & Sequences (API) ✅ COMPLETE
- [x] Email template CRUD: `GET/POST/PUT/DELETE /leadengine/email-templates`
- [x] Sequence builder: `GET/PUT /leadengine/campaigns/:id/sequences`
- [x] Brevo transactional API send (returns messageId for Phase 7 tracking)
- [x] Merge field injection (`{{company_name}}`, `{{contact_name}}`, `{{sender_name}}`, `{{campaign_name}}`, `{{unsubscribe_link}}`)
- [x] Auto-inject unsubscribe footer (Kenya DPA compliant — HTML + plaintext)
- [x] HMAC unsubscribe token — `GET /unsubscribe?p=&t=` public route in app.ts
- [x] `POST /leadengine/campaigns/:id/send/:step` — synchronous send, returns `{sent, skipped, failed, errors}`
- [x] `GET /leadengine/campaigns/:id/email-stats` — totals + by-step breakdown
- [x] `GET /leadengine/campaigns/:id/send-preview/:step` — eligible/noEmail/alreadySent counts
- [x] UI: "Send now" button per sequence step with eligible count preview
- [x] UI: Send result banner (sent/skipped/failed) shown inline after send
- [x] UI: Results tab now fetches real stats from API with Refresh button
- [x] 200ms per-send rate limit to respect Brevo free-tier limits
- [ ] Scheduling: Day 5 and Day 10 auto-sends (manual trigger for v1; auto-schedule in future)

---

## Phase 7 — Engagement Tracking (API) ✅ COMPLETE
- [x] Brevo webhook endpoint: `POST /webhooks/brevo` — secured by `X-WizCRM-Webhook-Key` header
- [x] Map Brevo `message-id` → `EmailSend` record via `brevoMessageId` index
- [x] Update `openedAt`, `clickedAt`, `repliedAt` on matching events
- [x] Auto-convert prospect → CRM Lead on reply (duplicate guard included)
- [x] Replied lead tagged with `replied-to-outreach` + tier tag in CRM
- [x] Unsubscribe event → addSuppression + prospect status → SUPPRESSED
- [x] Hard/soft bounce + spam/blocked → EmailSend status FAILED + contact emailStatus → invalid
- [ ] Notify campaign owner on reply — deferred (no in-app notification system yet)

---

## Phase 8 — UI: Lead Generator Pages (Web) ✅ COMPLETE
- [x] "Lead Generator" nav link under Leads in sidebar (icon: ai)
- [x] **Campaigns List page** — cards: status, prospects count, emails sent, replies
- [x] **Create Campaign form** — name, goal, keywords, locations, size band
- [x] **Campaign Detail page** — tabs: Prospects | Email Outreach | Results
- [x] **Prospects tab** — grid: Company, Sector, Tier badge, Score, Phone, Website, checkbox
  - [x] Bulk actions: Import to Pipeline, Suppress
  - [x] Run Discovery button + live polling progress banner
  - [x] Manual Add Prospect button
- [x] **Prospect Detail drawer** — score breakdown, enrichment, contacts, Import + Suppress actions
- [x] **Email Outreach tab** — template builder with merge fields, 3-step sequence configurator
- [x] **Results tab** — Sent / Opened / Clicked / Replied stats (zero-state; live data in Phase 7)
- Files: `web/src/pages/LeadGeneratorPage.tsx`, `web/src/pages/CampaignDetailPage.tsx`, `web/src/components/lead-engine/ProspectDrawer.tsx`, `web/src/lib/lead-engine-types.ts`

---

## Phase 9 — Pipeline Integration ✅ COMPLETE
- [x] `POST /leadengine/prospects/:id/import` — creates CRM Lead, duplicate guard
- [x] `POST /leadengine/campaigns/:id/bulk-import` — batch import, returns imported/skipped/errors summary
- [x] Imported lead shows "Lead Generator ↗ view campaign" link in CRM lead drawer (source field)

---

## Phase 10 — Hardening & Compliance ✅ COMPLETE
- [x] Rate limit: discovery 5 req/min, send 3 req/min (per-IP via @fastify/rate-limit)
- [x] Sanitize provider errors — Google Places key in header only, never in logged error body
- [x] Kenya DPA: `DELETE /leadengine/prospects/:id` hard-deletes all PII (cascade removes contacts, enrichment, email sends)
- [x] Unit tests: 21 passing — normalizeName, buildDedupHash, scoreCandidate (7 cases), parseScoringRules, verifyUnsubToken
- [x] `docs/LEADENGINE.md` — full setup guide (env vars, DB push, Brevo webhooks, DPA compliance table, troubleshooting)
- [ ] Rate limiting on enrichment jobs (Phase 5 not yet built — deferred)
- [ ] Page cache (Phase 5 not yet built — deferred)
- [ ] Integration test: full E2E flow — deferred (requires seeded campaign + Google Places mock)

---

## Decisions Log
| Date | Decision |
|------|----------|
| 2026-06-25 | Lead Generator nested under Leads in sidebar |
| 2026-06-25 | Use Brevo Campaign API for bulk sends |
| 2026-06-25 | 3-touch sequence: Day 0, Day 5, Day 10 — stops on reply |
| 2026-06-25 | Auto-convert replied prospect → CRM Lead |
| 2026-06-25 | AI discovers 90% of prospects; 10% manual add |
| 2026-06-25 | BREVO_API_KEY used for both transactional and campaign sends |
| 2026-06-25 | Campaigns are the unit of lead generation |
