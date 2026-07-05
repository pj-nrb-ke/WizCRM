# WizCRM Mobile — Field Sales Reporting & Enablement

> **Status:** v1.1 · D1–D3 locked · **Date:** 2026-07-05 · **Scope:** mobile (Expo 54 / RN 0.81) · **Prepared for:** PJ (Wise & Agile)

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

## Decisions (locked 2026-07-05 — PM call)

All three ship as **org-level settings** a manager can tune; the values below are the launch defaults. Every limit is **enforced server-side** — per Verification, the API has no guardrail today, so a UI-only limit is no limit.

### D1 · Cost guardrail → **cache-first + per-rep quota + org ceiling**
- **Finder: 30 lookups / rep / month** — cache hits cost 0, so repeat lookups don't count (~1.5 per working day; fits field cadence).
- **ICP Generator: 4 runs / rep / month** — the expensive path (Apify + Firecrawl + Apollo); ~1 batch/week.
- **Org monthly ceiling** (manager-set) as a hard backstop, so the sum of rep usage can never exceed the API budget.
- Rep sees remaining quota in-app ("18 / 30 left") — a guardrail, not a mystery wall.
- *Why:* keeps the "on the fly" autonomy while making spend predictable. Approval-per-run defeats the point; no-quota lets one curious rep burn the month's budget in an afternoon.

### D2 · Who gets it → **split by cost & judgment** (not one flag — two)
- **Lead Finder → every salesperson.** Cheap, cached, and it *is* the core mobile moment — standing in front of a prospect, needing their email. Contained by the D1 quota.
- **Lead / ICP Generator → senior reps & team leads only.** Expensive batch run that needs ICP judgment; junior reps still work the leads it produces, they just don't spend credits generating them.
- *Why:* maximizes the value every rep needs while ring-fencing the costly, judgment-heavy tool. One entitlement flag each — widen the Generator once D1 proves out.

### D3 · Quotes → **direct send, approval only above a discount threshold**
- Rep sends standard quotes directly. A quote **> 10% discount off list** enters **Pending approval** (manager notified) before Send unlocks.
- Absolute-value gate exists but is **off by default** — turn on per org if large deals warrant a second look.
- The quote is still **built and shown to the customer on the spot**; only the Send button waits. On-the-fly survives, margin is protected.
- *Why:* reps erode margin through discounting, not through honest list-price quotes — so gate the discount, not the speed.

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
- **Guardrail (per D1/D2):** Finder = all reps @ 30 lookups/mo · Generator = seniors @ 4 runs/mo · org ceiling · **enforced server-side**. Lean on Finder's 30-day cache.
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

*WizCRM · Mobile Field Sales · Requirements & Build Plan · v1.1 (D1–D3 locked) · 2026-07-05*
