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
- ✅ Notification when an **LPO** is uploaded → notifies all active Admin/Manager users via `notifyUser()` (push + in-app), from `lead-thread.service.ts`'s `createLeadAttachment`.
- Verified end-to-end against local dev DB: created an opportunity, expanded its card, posted a note, uploaded via the doc-type picker, added a task — all three scoped endpoints (`/leads/:id/messages`, `/leads/:id/attachments`, `/tasks`, each with `?opportunityId=`) returned 200/201 with no console errors.

### Phase 2 — Cost center (budget / expenses / revenue / margin)
- ⬜ Surface existing `SalesOpportunity.budgeted` and `forecastedExcl` fields in the UI (already in the DB, just never exposed — no schema change needed for these two).
- ⬜ New `OpportunityExpense` model: description, category (travel/samples/labor/other), amount, date, logged-by, optional receipt attachment.
- ⬜ Summary strip per opportunity: **Budget → Spent → Remaining → Revenue → Margin**, flagged red when `Spent > Budget` (same visual treatment as Data Hygiene warnings).
- ⬜ Roll-ups: Lead level (sum across its opportunities) and org level (new line on Reports page: total budget vs spend vs revenue, "which deals are over budget").
- **Permissions:** budget set/edit = Manager+; expense logging = opportunity owner; money view = owner + Manager+.

### Phase 3 — Commission engine
**Confirmed logic (corrected from earlier drafts — commission is document-total-based, NOT tied to budget/forecast):**

| Document uploaded | Effect |
|---|---|
| None | No commission shown at all |
| Quotation or Proforma Invoice | **Forecasted commission** = rate × that document's total (latest one if several). Labeled "Forecast — not owed yet." |
| Invoice (actual) | **Commission due** = rate × invoice total. Replaces the forecast. |
| LPO | No amount effect — stamps `collectibleFromDate`. From this date the salesperson is eligible to collect, **subject to customer payment**. |

- ⬜ **Customer payment log** (admin-entered: amount + date, against the invoice) — commission is **collectible only in proportion to what's been paid** by the customer (e.g. customer paid 60% → up to 60% of commission is collectible). This is the deliberate incentive for the salesperson to chase payment.
- ⬜ **Commission payout log** (admin-entered, partial/full) — capped at whatever is currently collectible.
- ⬜ Salesperson view per opportunity, one of: *No commission yet* / *Forecasted: X* / *Due: Y — collectible from [LPO date], pending customer payment* / *Collectible now: Z of Y* / *Paid: A · Pending: B*.
- ⬜ Salesperson dashboard number: running "pending commission across my deals."
- ⬜ Admin/Manager view: org-wide commission liability — forecasted, due, collectible, paid, pending — broken down by salesperson (Reports page).

**Settings → Commission** (Admin/Manager only):
- ⬜ **Org-wide on/off switch** — when off, no forecast/due/collectible shown anywhere for anyone; existing history is preserved, not deleted.
- ⬜ **Per-salesperson on/off** — even with the org switch on, individual people can be excluded (new hires without a negotiated arrangement, house accounts, etc).
- ⬜ **Per-salesperson rate** — freely editable percentage per person (reflects individually negotiated deals at hiring), org default fallback for anyone without one set.
- ⬜ Rate changes are **never retroactive** — every opportunity locks in whatever rate was active at the moment its commission was computed (quotation/invoice upload time), so editing someone's rate later only affects their future deals.

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
