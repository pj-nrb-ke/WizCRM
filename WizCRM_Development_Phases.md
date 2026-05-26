# WizCRM — Development phases (priority roadmap)

Source: **WizCRM Features.pdf** (product brochure list).  
Technical detail: [SRS.md](./SRS.md) · Implementation status: [PROGRESS_TRACKER.md](./PROGRESS_TRACKER.md)

WizCRM is a lead-lifecycle CRM for sales and field teams (Wise & Agile Solutions Ltd.). Features are grouped into **three development phases** by priority: what enables daily sales use first, what differentiates field teams next, and what scales the platform and ERP later.

---

## Phase 1 — Core CRM (highest priority)

**Goal:** A sellable, daily-use CRM for reps and managers—lead → pipeline → activity → close—with web + mobile parity on essentials.

| Area | Features |
|------|----------|
| **Core CRM** | Lead management (contact, company, source, owner, tags); lead search & filters; lead detail view (stage, next action, history); duplicate detection (email/phone); assignment & handoff; audit trail |
| **Pipeline** | Lifecycle stages (New → Contacted → Qualified → Proposal → Negotiation → Won/Lost); visual pipeline (Kanban/list); stage history; close Won (value, products); close Lost (structured reasons); reopen leads; stale lead alerts; configurable stages |
| **Activities** | Unified timeline; call logging; email logging (touchpoints); meetings (schedule, link to lead); tasks & reminders; internal notes; next action on lead |
| **Dashboards & reporting (baseline)** | Personal dashboard; manager dashboard (team funnel); export to CSV |
| **Web administration (baseline)** | User & team management; sources & loss reasons; system settings (stale days, org defaults); bulk import; bulk updates (assign / stage) |
| **Mobile (baseline)** | iOS & Android app; tap-to-call & email; add leads on the go; compact mobile pipeline; post-call lead prompt |
| **Security (baseline)** | Secure sign-in |
| **Platforms** | Web application; mobile application |

**Why Phase 1 first:** Without a reliable lead record, pipeline, timeline, and follow-ups, nothing else (geofence, ERP, AI extras) pays off. This is the minimum viable **lead-lifecycle CRM**.

**Repo alignment:** P0–P6 (hosting, Lite mobile, web admin/manager clusters, infrastructure) largely map here—many items are delivered or in sign-off.

---

## Phase 2 — Field proof, analytics & integrations (medium priority)

**Goal:** Prove field activity, improve management insight, and connect to the outside world—before heavy ERP or enterprise platform work.

| Area | Features |
|------|----------|
| **Field sales (advanced)** | Push notifications; offline-friendly mobile (view + draft + sync) |
| **Meeting location & attendance** | Meeting destination on map; navigate (Google/Apple Maps); geofence check-in; geofence check-out; attendance status (on-time, late, no-show, partial); manager override; meeting attendance reports |
| **Dashboards & reporting (advanced)** | Conversion analytics (by stage, source, owner, period); time in stage; win/loss analysis; saved views |
| **Quotations (pre-ERP)** | Quotations in WizCRM (lines, qty, price, discount, tax linked to lead) |
| **Integrations & automation** | Web lead capture; webhooks; automation rules (auto-assign, stale reminders, etc.) |
| **Calendar & email (planned)** | Calendar sync (Google / Microsoft); email integration (mailbox sync)—beyond basic logging in Phase 1 |
| **Multi-tenant SaaS (operational)** | Cloud multi-tenant; organization workspaces; subdomain/tenant login; roles per organization; multi-organization users; seat-based licensing; data export & offboarding |
| **Admin depth** | Custom fields (no-code); per-organization branding (logo/colours) |
| **Post-sale (light)** | Convert to customer account; account timeline; renewal & upsell tracking |
| **Compliance (baseline)** | Location transparency (consent/policy for geofence) |

**Why Phase 2 second:** Matches the **field-sales and proof-of-visit** story and gives managers oversight (attendance, conversion, win/loss). Quotations and webhooks prepare for ERP without full accounting sync yet.

**Repo alignment:** P7–P8 (Pro platform + product features) map primarily here.

---

## Phase 3 — ERP, commercial platform & premium roadmap (lower priority / scale)

**Goal:** Enterprise revenue (licensing, ERP), deep compliance, and optional premium capabilities from the product roadmap section.

| Area | Features |
|------|----------|
| **Quotations & ERP** | Sync quotes to ERP; customer sync with ERP; integration framework (SAGE Evolution 200, SAP Business One, QuickBooks, Tally); field mapping; scheduled & manual sync; sync audit log; ERP product catalog (optional) |
| **Commercial licensing (ScaleGate)** | ScaleGate integration; plan-based features (geofence, ERP, call prompts by plan); license status in app; graceful renewal / read-only on lapse |
| **Integrations (advanced)** | Slack / Teams alerts (planned) |
| **Security & compliance (enterprise)** | SSO & two-factor; encrypted credentials (ERP); GDPR-ready export/delete |
| **Optional enhancements (roadmap)** | Dark/light themes; customizable home screen; pinned leads & recent search; team chat on lead; @mentions; document attachments & templates; e-signature; business card scan; email templates; AI timeline summary; AI suggested next action; lead scoring; snooze lead; report builder; quotas & forecasts; leaderboards; home screen widget; biometric unlock; arrival photo |

**Why Phase 3 last:** ERP and ScaleGate are high cost, high risk, and depend on stable Phase 1–2 data models. Optional enhancements are differentiation for higher tiers, not blockers for first customers.

**Repo alignment:** P9 Enterprise, deferred P10 (Web Cluster D), and PDF “optional enhancements” map here.

---

## Summary

| Phase | Focus | Typical buyer outcome |
|-------|--------|------------------------|
| **1** | Core lead lifecycle + pipeline + activities + basic admin + mobile essentials | “We can run sales on WizCRM every day.” |
| **2** | Field attendance proof + analytics + quotes + capture/automation + multi-tenant ops | “We trust field visits and manage the funnel with data.” |
| **3** | ERP sync + licensing + enterprise security + premium/AI roadmap | “We’re aligned with accounting and can scale commercially.” |

---

## Mapping to repository phases

| Repo phase ([PHASE-STATUS.md](./PHASE-STATUS.md)) | Product phase |
|---------------------------------------------------|---------------|
| P0–P6 (hosting, Lite, web A/B, polish, infra) | Phase 1 |
| P7–P8 (Pro platform + product) | Phase 2 (+ early Phase 3) |
| P9 Enterprise | Phase 3 |
| P10 Web Cluster D (deferred) | Phase 2–3 as prioritized |
| P11 Business (MGT) | Cross-cutting (legal, stores, ERP partnerships) |

---

*Last updated: 2026-05-26*
