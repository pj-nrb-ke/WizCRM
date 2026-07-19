# WizCRM — Feature Tracker

Status legend: ⬜ Not started · 🔄 In progress · ✅ Done · ⏸ Deferred (later phase)

This file tracks features that have been scoped/agreed with PJ but not yet built, so work can resume across sessions without re-deriving the spec. Update status inline as work proceeds. Keep completed items here (marked ✅) rather than deleting them, so this stays the single source of truth for what shipped vs what's pending.

---

## Opportunity: Cost Center & Commission

**Context:** A Lead can have multiple concurrent Sales Opportunities (repeat customers, multiple live deals). Today, opportunities share one lead-level attachment pool and chat thread — no per-opportunity tracking exists. This build makes each Opportunity a real cost-center: its own documents, expenses, budget/revenue/margin, and a commission engine on top, without collapsing Lead and Opportunity into one entity (that was considered and explicitly rejected — see rationale below).

**Rationale for keeping Lead + Opportunity separate (rejected the merge):** A Lead is the account/contact — one company, one visit history, one shared chat about them. An Opportunity is one specific deal. Collapsing them would force a duplicate "lead" per repeat deal with the same customer, fragmenting visit/call/chat history. Instead: extend Opportunity with its own tracking, keep Lead as the aggregating parent.

### Phase 1 — Opportunity documents & tagging ✅ Done (2026-07-19)
- ✅ Added optional `opportunityId` to `LeadAttachment`, `LeadMessage`, `Task`, `UserReminder`, and `Quotation` (`api/prisma/schema.prisma`), plus reverse relations on `SalesOpportunity`.
- ✅ Document **type tag** on upload: `GENERAL` / `QUOTATION` / `PROFORMA_INVOICE` / `INVOICE` / `LPO` (new `LeadAttachmentDocType` enum, defaults to `GENERAL`).
- ✅ Opportunity card: web `LeadDrawer.tsx` opportunity rows are now expandable, mounting an opportunity-scoped `LeadTeamChat` (notes + documents, filtered by `opportunityId`, with the doc-type picker) and a new `OpportunityTasks` component. Mobile `LeadOpportunities.tsx` rows are tappable, mounting the same scoped `LeadTeamChat` + new `OpportunityTasks` component.
- ✅ Notification when an **LPO** is uploaded → notifies all active Admin/Manager users via `notifyUser()` (push + in-app), from `lead-thread.service.ts`'s `createLeadAttachment` — same push+in-app pipeline used for @mention notifications (commit `b0da32b`).
- Verified end-to-end against local dev DB: created an opportunity, expanded its card, posted a note, uploaded via the doc-type picker, added a task — all three scoped endpoints (`/leads/:id/messages`, `/leads/:id/attachments`, `/tasks`, each with `?opportunityId=`) returned 200/201 with no console errors.
- **Deployed to production 2026-07-19** (commits `97309c7`, `b0da32b`): schema pushed to the prod DB via `prisma db push`, api + web rebuilt and restarted on the VPS, `https://api.wizcrm.app/health` confirmed `{"status":"ok","db":"up"}` post-deploy.

### Phase 2 — Cost center (budget / expenses / revenue / margin) ✅ Done (2026-07-19)
- ✅ Surfaced `SalesOpportunity.budgeted`/`forecastedExcl` in the create form, gated to Manager+ (web `SalesOpportunityForm.tsx`, mobile `SalesOpportunitySheet.tsx`).
- ✅ **Revenue source decision (PJ, 2026-07-19): Invoice totals.** Added an optional `amount` (Decimal) to `LeadAttachment`, captured only when a document is tagged Quotation/Proforma Invoice/Invoice on upload (web `LeadTeamChat.tsx` "Document total" field, mobile equivalent). Revenue = sum of `amount` across an opportunity's `INVOICE`-tagged attachments.
- ✅ New `OpportunityExpense` model + `ExpenseCategory` enum (TRAVEL/SAMPLES/LABOR/OTHER): description, category, amount, date, logged-by, optional receipt attachment link. CRUD under `/opportunities/:id/expenses` (`opportunity-expense.service.ts`).
- ✅ Summary strip per opportunity — **Budget → Spent → Remaining → Revenue → Margin**, flagged red (`over-budget` class + alert) when `Spent > Budget` — web `OpportunitySummaryStrip.tsx`, mobile equivalent, mounted in the expanded opportunity card.
- ✅ Roll-ups: lead-level (sum across its opportunities, shown above the opportunity list in `LeadDrawer.tsx`, Manager+ only) and org-level (`GET /reports/cost-rollup`, new "Opportunity cost centers" card on the Reports page listing any deals over budget).
- ✅ **Permissions enforced server-side and UI-gated:** budget set/edit = Manager+ (`PATCH /opportunities/:id` 403s a non-manager `budgeted` change; `POST /opportunities` silently drops it); expense logging = opportunity owner only (403 otherwise); money view (summary + expense list) = owner + Manager+ (403 otherwise). Verified via direct API calls as a non-owner Sales rep — all three correctly returned 403.
- Verified end-to-end against local dev DB as both Manager (owner) and Sales rep (non-owner): created an opportunity with a budget, logged an expense (summary strip updated live), uploaded an Invoice-tagged document with a total (revenue + margin updated live), confirmed the over-budget red flag and its row on the Reports rollup, and confirmed the non-owner rep is blocked from all three gated actions.
- **Deployed to production 2026-07-19** (commit `5160580`): schema pushed to the prod DB via `prisma db push`, api + web rebuilt and restarted on the VPS, `https://api.wizcrm.app/health` confirmed `{"status":"ok","db":"up"}` post-deploy.

### Phase 3 — Commission engine ✅ Done (2026-07-19)
**Confirmed logic (corrected from earlier drafts — commission is document-total-based, NOT tied to budget/forecast):**

| Document uploaded | Effect |
|---|---|
| None | No commission shown at all |
| Quotation or Proforma Invoice | **Forecasted commission** = rate × that document's total (latest one if several). Labeled "Forecast — not owed yet." |
| Invoice (actual) | **Commission due** = rate × invoice total. Replaces the forecast. |
| LPO | No amount effect — stamps `collectibleFromDate`. From this date the salesperson is eligible to collect, **subject to customer payment**. |

- ✅ New `OpportunityCommission` model (1:1 per opportunity), recomputed on every Quotation/Proforma/Invoice upload — an Invoice always wins over a Quotation/Proforma, latest document wins within a tier. `commission.service.ts`.
- ✅ **Customer payment log** (`OpportunityCustomerPayment`, admin-entered: amount + date) — commission is collectible only in proportion to payment **against the invoice total** (e.g. customer paid 50% of a 20,000 invoice → 50% of the commission due is collectible, not 50% of the commission amount itself — this distinction was a real bug caught during verification and fixed before shipping).
- ✅ **Commission payout log** (`OpportunityCommissionPayout`, admin-entered) — server-side capped at what's currently collectible minus what's already been paid out; over-payout attempts 400.
- ✅ Salesperson view per opportunity (`OpportunityCommission.tsx` web + mobile, mounted in the expanded opportunity card): *No commission yet* / *Forecast: X — not owed yet* / *Due: Y — collectible once an LPO is uploaded* / *Due: Y — collectible from [LPO date], pending customer payment* / *Collectible now: Z of Y* / *Paid: A · Pending: B*.
- ✅ Salesperson dashboard number: "Pending commission" tile on the home dashboard (web `HomePage.tsx`, mobile `home.tsx`), summed across all of the user's opportunities via `GET /commission/my-pending`.
- ✅ Admin/Manager view: org-wide commission liability by salesperson — forecasted/due/collectible/paid/pending — new "Commission liability" card on the Reports page, via `GET /commission/liability`.

**Settings → Commission** (`/settings/commission`, Manager+ — new dedicated `commission.ts` routes, not the Admin-only `/admin/users`):
- ✅ **Org-wide on/off switch** — when off, `getOpportunityCommissionView`/`getMyPendingCommission`/`getOrgCommissionLiability` all return hidden/empty; verified turning it back on restores the exact same historical numbers (nothing is deleted, only hidden).
- ✅ **Per-salesperson on/off** (`User.commissionEnabled`, default true) — excluded people are hidden the same way as the org switch.
- ✅ **Per-salesperson rate** (`User.commissionRatePct`, nullable) — falls back to `Organization.settings.commissionDefaultRatePct` when unset.
- ✅ Rate changes are **never retroactive** — `ratePctLocked` is snapshotted onto the `OpportunityCommission` row at the moment of each recomputation (next Quotation/Proforma/Invoice upload), never rewritten by a later rate edit.
- Verified end-to-end: quotation upload → forecast; invoice upload → forecast replaced by due; LPO upload → `collectibleFromDate` stamped once (idempotent); partial customer payment → proportional collectible; payout capped at collectible (over-payout correctly 400s); org toggle off/on hides/restores history; non-owner, non-manager rep correctly 403'd on money-view, payment logging, payout logging, and settings.

### Phase 4 — Deferred / later
- ⏸ Structured invoice generation in-app (line items, status) — mirrors how Quotations work today. Today invoices are just uploaded documents.
- ⏸ Receipt photo → AI auto-fill expense amount (same pattern as business-card scan).
- ⏸ Commission/expense approval workflow (spend requiring sign-off before it counts).

**Build order:** Phase 1 → Phase 2 → Phase 3. Phase 3 depends on Phase 1's document-type tagging.

---

## How to use this file
- When starting a phase, flip its checkbox items to 🔄 as they're picked up, ✅ when shipped and verified.
- If scope changes mid-build (PJ adjusts a requirement), edit the spec text in place rather than appending a contradicting note below it — this file should always reflect the *current* agreed spec, not a change log (git history covers that).
- New feature requests from PJ that are scoped but not yet started should be added here as a new section, following the same format (context → rationale if relevant → phased checklist → permissions/settings notes).
