# WizCRM — Manager task tracker

Non-technical and business tasks from **[manager_tasks.md](./manager_tasks.md)**. Engineering tracks **`TOOL-*`** and **`FR-*`** in [PROGRESS_TRACKER.md](./PROGRESS_TRACKER.md).

**Legend:** ⬜ Not started · 🟡 In progress / product ready · ✅ Done · ⏸ Deferred · ❌ Cancelled · N/A Not applicable

**Last updated:** 2026-05-26

**Live checklist (web):** Managers → **Business checklist** (`/business`)

---

## Summary

| Category | Total | Done | In product / templates | Owner action |
|----------|------:|-----:|----------------------:|-------------:|
| Maps & location | 5 | 0 | 2 templates | 3 |
| ScaleGate / commercial | 5 | 1 | 2 docs | 2 |
| ERP | 6 | 0 | 0 | 6 |
| App stores | 4 | 0 | 0 | 4 |
| Brand & ops | 4 | 3 | 1 | 0 |
| **Total** | **24** | **4** | **5** | **15** |

*Engineering complete for product-configurable items; Legal/IT/Store tasks remain with owners.*

---

## Maps and location

| Status | ID | Task | Owner | Notes |
|--------|-----|------|-------|-------|
| ⬜ | MGT-001 | Google Cloud project + billing | IT / Product | |
| ⬜ | MGT-002 | Enable Maps / Geocoding APIs | IT | |
| ⬜ | MGT-003 | Create and restrict API keys | IT | Hand keys to dev via secure channel |
| 🟡 | MGT-004 | Publish **privacy policy** (location) | Legal / Product | Template: `docs/compliance/privacy-policy-template.md` |
| 🟡 | MGT-005 | **Staff consent / tracking policy** | Legal / HR | Template: `docs/compliance/staff-tracking-policy-template.md` |

---

## ScaleGate and commercial SaaS

| Status | ID | Task | Owner | Notes |
|--------|-----|------|-------|-------|
| 🟡 | MGT-006 | Define **subscription plans** | Product | `docs/MGT-COMMERCIAL-PLANS.md` |
| ⬜ | MGT-007 | ScaleGate license API documentation | Product / ScaleGate | |
| ✅ | MGT-008 | **Map plan codes** to WizCRM features | Product | `docs/MGT-PLAN-MAPPING.md` + `entitlements.ts` |
| ⬜ | MGT-009 | Customer onboarding flow | Product / Ops | |
| 🟡 | MGT-010 | **Terms of Service** and **DPA** | Legal | `docs/compliance/` templates |

---

## ERP integrations

| Status | ID | Task | Owner | Notes |
|--------|-----|------|-------|-------|
| ⬜ | MGT-011 | ERP priority order | Product | |
| ⬜ | MGT-012 | SAGE Evolution 200 sandbox/SDK | Product / Vendor | |
| ⬜ | MGT-013 | SAP Business One sandbox | Product / IT | |
| ⬜ | MGT-014 | QuickBooks Intuit developer + OAuth | Product / IT | |
| ⬜ | MGT-015 | Tally SDK/docs | Product / Vendor | |
| ⬜ | MGT-015b | Pilot customer for ERP | Product | ERP sync stub live in app |

---

## App stores

| Status | ID | Task | Owner | Notes |
|--------|-----|------|-------|-------|
| ⬜ | MGT-016 | Google Play Developer account | Product | |
| ⬜ | MGT-017 | Apple Developer Program | Product | |
| ⬜ | MGT-018 | Store listings | Product / Marketing | |
| ⬜ | MGT-019 | Play Data safety + rating | Product / Legal | |

---

## Brand and operations

| Status | ID | Task | Owner | Notes |
|--------|-----|------|-------|-------|
| ✅ | MGT-020 | SaaS domain and DNS | Product / IT | `app.wizcrm.app`, `api.wizcrm.app` |
| 🟡 | MGT-021 | Support email / status page | Ops | Support email in **Branding** settings; status page TBD |
| ✅ | MGT-022 | Default geofence radius | Product | CRM lists → check-in radius (meters) |
| ✅ | MGT-023 | Meeting grace + attendance rules | Product | CRM lists → meeting grace minutes |

---

## Related

- [manager_tasks.md](./manager_tasks.md) — Full task descriptions  
- [SRS.md](./SRS.md) — Requirements §20–21  
- [PROGRESS_TRACKER.md](./PROGRESS_TRACKER.md) — Engineering progress
