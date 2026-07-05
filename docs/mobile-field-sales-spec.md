# WizCRM Mobile — Field Sales Reporting & Enablement

> **Status:** Draft v1 · **Date:** 2026-07-05 · **Scope:** mobile (Expo 54 / RN 0.81) · **Prepared for:** PJ (Wise & Agile)

Turn the mobile app into the salesperson's field tool: capture what happens with the customer, and carry everything needed to sell — leads, quotes, email, and the latest catalog — into places with no signal.

**Shareable one-pager:** https://claude.ai/code/artifact/144bdedc-2990-4721-a107-f3598cfec4e0

---

## R1 · The frame

Mobile is the salesperson's **field reporting & enablement** tool — capture-first from wherever the rep is standing. Setup, admin, and configuration stay on the web app. The app is already built this way; this is a focusing decision, not a rebuild.

---

## Part 1 — Requirements

Status legend: **Exists** = already on mobile, polish only · **API-ready** = backend exists, needs a mobile screen · **New** = net-new model & endpoints.

| # | Requirement | Status | Today | Build |
|---|---|---|---|---|
| **R2** | **Check leads** | Exists | Leads tab + `offline-leads-cache` | Server-side search, quick filters (mine / hot / overdue), "leads near me" via existing geofencing |
| **R3** | **Lead Generator & Lead Finder on mobile** | API-ready | Web nav only; APIs open (see Verification) | Mobile screens on `/contacts/finder` + `/leadengine` + cost guardrail |
| **R4** | **Send email to the customer** | API-ready | `POST /email/leads/:id/send` (Brevo) exists; mobile has only `mailto:` | Compose UI + template picker + attach from library |
| **R5** | **Quotations on the fly** | Exists | Create + mark-sent in `LeadQuotations` | Branded PDF, share to WhatsApp/email, line items from catalog, full offline |
| **R6** | **Visit & meeting reports** | Exists (base) | `post-call.tsx` AI note → task → stage | Structured Visit Report: who met, outcome, competitor/objection, next-step (auto follow-up), voice, photos, geo+time stamp, offline |
| **R7** | **Brochure & catalog library** | **New** | Only per-lead `LeadAttachment` | `ProductDocument` model + endpoints + Library tab (browse, search, offline, attach, share) |

### Recommended additions (same direction)

- **Offline-first guarantee** — every report, quote, and email queues and auto-syncs (extend `offline-queue`). The line between a reporting tool and one that works where reps actually are.
- **Card scan → instant lead** — already built (`card-scan.ts`); just surface it on the Leads tab.
- **Share to WhatsApp** — send a quote or brochure straight to the customer; deep-link already exists, no new API.
- **Auto follow-up** — after a quote/email goes out, drop a follow-up reminder so nothing goes cold (becomes a push once server-push lands).
- **"My Day" + manager digest** — a rep's daily summary (visits, calls, quotes, emails) and a manager rollup.

---

## Open decisions (needed before Part 2 — shape R3 and R5)

Recommended default in **bold**; awaiting sign-off.

### D1 · Lead-gen / finder cost guardrails
Every ICP run hits paid providers (Apify + Firecrawl + Apollo); every Finder lookup hits Apollo/Hunter/Prospeo/Tomba/Firecrawl. Finder has a 30-day cache (repeat lookups = 0 credits); the ICP generator does not cache the same way.
- **(a) Cache-first + per-rep monthly quota** — e.g. 20 Finder lookups + 5 ICP runs / rep / month, cache hits don't count. Predictable cost, reps stay autonomous.
- (b) Manager-approval per run — tightest control, most friction, defeats "on the fly".
- (c) Cache-first only, no quota — simplest, power users can still overspend.
- ⚠️ **Must be enforced server-side** — see Verification (the API has no cost/role guardrail today).

### D2 · Who gets lead-gen & finder
One entitlement flag either way; affects cost blast-radius and data quality.
- **(a) Senior reps / team leads only** — start here, widen once D1 proves out.
- (b) Every salesperson — max pipeline, higher cost + more dupes/noise.

### D3 · Quotes to the customer
Speed vs. margin control. Mobile already lets a rep create + mark-sent.
- **(a) Direct send, with approval above a discount/total threshold** — reps move fast on standard quotes; only above-threshold discounts route to a manager.
- (b) Always manager-approve — tight, slow.
- (c) Always direct — fast, no margin guardrail.

---

## Part 2 — Phased build plan

Ordered by value-on-ready-infrastructure. Effort is rough single-dev t-shirt sizing; the enabler runs in parallel.

### Phase 1 · Visit Report + offline core — `M · ~1.5–2 wks`
- **Mobile:** extend `app/lead/post-call.tsx` into a structured Visit Report — voice (expo-audio), photos (expo-image-picker), geo stamp (expo-location); harden `lib/offline-queue.ts` to cover reports.
- **API:** extend activity logging + attachment write (reuse the lead-thread storage path); auto-create the follow-up task on save.
- **Why first:** the stated frame, biggest existing base, unblocks the reporting loop managers see.

### Phase 2 · Product Document Library (R7 — the one new model + API) — `M · ~2 wks`
- **Data:** new `ProductDocument` model via `prisma db push` (additive, prod-safe).
- **API:** list / stream / upload / update / soft-delete (below). Storage = the exact `LeadAttachment` pattern.
- **Mobile:** new `app/(tabs)/library.tsx` — browse, search, offline cache (expo-file-system), attach-to-quote/email, share-to-WhatsApp.
- **Web:** manager upload & manage screen.

### Phase 3 · Lead Finder & Generator on mobile — `M · ~2 wks`
- **Mobile:** `app/prospect/finder.tsx` + `app/prospect/generator.tsx` consuming `/contacts/finder` and `/leadengine` (APIs already ready).
- **Guardrail:** entitlement gate + per-rep quota (per D1/D2), **enforced server-side**. Lean on Finder's 30-day cache.
- **Note:** UI-heavy but no new backend.

### Phase 4 · In-app email compose — `S · ~1 wk`
- **Mobile:** `app/lead/email.tsx` — compose + template picker, attach from library, offline queue.
- **API:** reuse `POST /email/leads/:id/send` (Brevo, auto-logs to timeline). No backend change.

### Enabler (parallel) · Server push — `S–M · ~1 wk`
- **Mobile:** register an Expo push token → `POST /notifications/register` (notifications are local-only today).
- **Fires on:** lead assignment · customer reply · follow-up due. Powers auto follow-up and the reporting loop.

---

## R7 — the one new model & API

The only net-new backend. It deliberately mirrors what's already in the schema.

```prisma
model ProductDocument {
  id             String   @id @default(uuid())
  organizationId String
  organization   Organization @relation(fields: [organizationId], references: [id], onDelete: Cascade)
  title          String
  category       String?          // "Catalog" | "Brochure" | "Price list" | "Spec sheet"
  productTags    String[]         // ties a document to product lines (feeds quote lines)
  fileName       String
  mimeType       String
  sizeBytes      Int
  storagePath    String           // same local-disk pattern as LeadAttachment
  version        Int      @default(1)
  isActive       Boolean  @default(true)
  uploadedById   String
  uploadedBy     User     @relation(fields: [uploadedById], references: [id])
  createdAt      DateTime @default(now())
  updatedAt      DateTime @updatedAt

  @@index([organizationId, isActive])
  @@index([organizationId, category])
}
```

```http
GET    /documents                 list · ?category= & ?q= search   → rep, offline-cached
GET    /documents/:id/file        stream file via createReadStream → rep
POST   /documents                 multipart upload + metadata       → manager (web)
PATCH  /documents/:id             rename · re-tag · deactivate · bump version
DELETE /documents/:id             soft delete (isActive = false)
```

**No new storage infra.** Upload does `mkdir` + `writeFile(storagePath)`; download streams it back — the same code path as `api/src/services/lead-thread.service.ts`. Additive `db push`, no migration, prod-safe.

---

## Definition of done

- A rep can, **with no signal**, log a visit with voice + photo + location, build and share a quote, and pull up the latest catalog — and it all syncs when signal returns.
- A rep can **find a contact and email them** without leaving the app, and it lands on the lead timeline.
- A manager sees **the day's field activity** without having to ask for it.

---

## Verification — R3 gating claim (independently reviewed 2026-07-05)

**Claim:** the Lead Generator (`/leadengine/*`) and Lead Finder (`/contacts/finder`) APIs are auth-only — no server-side role or plan/entitlement gate; the "Manager only" behaviour is web-UI only.

**Verdict: CONFIRMED.** Evidence:
- Both route plugins guard with `app.addHook('onRequest', app.authenticate)` **only** (`contact-finder.ts:8`, `lead-engine.ts:28`). No `preHandler`, no `request.user.role` check, no entitlement call on any of the ~30 handlers.
- `app.authenticate` (`app.ts:58`) only runs `request.jwtVerify()` (valid, unexpired token → 401 otherwise). The JWT payload carries `role`, but nothing inspects it here.
- No app-wide entitlement middleware wraps these routes. Entitlements exist (`resolveEntitlements`) but are opt-in per route and are **not** imported by either file.
- The restriction is client-side React only: route guards `ManagerOnly`/`AdminOnly` (`web/src/App.tsx`) + hidden nav (`web/src/components/Layout.tsx`).

**Implication (two-sided):**
1. **Good:** putting these on mobile is pure UI + entitlement work — the backend already allows it.
2. **⚠️ Security / cost:** these paid-provider endpoints are **already callable by any authenticated user** via direct API (curl/Postman), bypassing the React guards. So the **D1 cost guardrail (and any role restriction) must be enforced server-side**, not just in the mobile UI. Fold into the security pre-launch backlog.

---

*WizCRM · Mobile Field Sales · Requirements & Build Plan · Draft v1 · 2026-07-05*
