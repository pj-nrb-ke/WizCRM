# WizCRM — Software Requirements Specification (SRS)

| Field | Value |
|-------|--------|
| **Product** | WizCRM |
| **Organization** | Wise & Agile Solutions Ltd (WIZAG) |
| **Document version** | 1.1 |
| **Date** | 2026-05-17 |
| **Status** | Approved for implementation planning |
| **Related docs** | [LEAD_LIFECYCLE.md](./LEAD_LIFECYCLE.md), [PROGRESS_TRACKER.md](./PROGRESS_TRACKER.md) |

This document is the **single product and requirements reference** for WizCRM. Implementation agents and developers should treat requirement IDs (`FR-*`, `NFR-*`) as traceable items; completion status lives in **[PROGRESS_TRACKER.md](./PROGRESS_TRACKER.md)**.

---

## 1. Purpose and scope

### 1.1 Purpose

WizCRM is a customer relationship management application that tracks the **full lifecycle of every lead**—from first contact through qualification, engagement, conversion (won/lost), and optionally post-sale account management. It gives sales and operations teams one system for status, history, next actions, and field-activity proof (calls and on-site meetings).

### 1.2 In scope

- Web application (`web/`) for desktop workflows, administration, and reporting.
- Mobile application (`mobile/`, Expo / React Native) for field sales: calls, meetings, pipeline on the go.
- Shared contracts and types (`shared/`) consumed by web and mobile.
- Backend API and database (to be implemented; stack TBD).
- Lead lifecycle per [LEAD_LIFECYCLE.md](./LEAD_LIFECYCLE.md).
- **Multi-tenant SaaS** platform model (Section 4).
- **Commercial licensing** via **ScaleGate** cloud API (Section 5).
- **Post-call lead attachment** on mobile (Section 8).
- **Meeting geofence attendance** (Section 9).
- **ERP / accounting integrations** — customer and quotation sync (Section 16).
- Features listed in Sections 6–15 (core, mobile, web, reporting, integrations, nice-to-have).

### 1.3 Out of scope (initial releases)

- Full marketing automation platform (email campaigns at scale).
- Native desktop apps (web only).
- Built-in VoIP / dialer replacement (integrate or use device dialer).
- Payroll or HR attendance systems (geofence is meeting-scoped, not clock-in for employment).
- **In-app payment processing** — subscription billing and license issuance are owned by **ScaleGate**; WizCRM validates entitlements via API only.
- **Concrete ERP SDK implementations** until vendor APIs/SDKs are provided by the product owner (requirements and adapter contracts are in scope now).

### 1.4 Definitions

| Term | Definition |
|------|------------|
| **Tenant** | A subscribing customer organization; all CRM data is isolated by `tenant_id`. |
| **Organization / Org** | Synonym for tenant in UI and docs. |
| **Lead** | Person or organization that may become a customer. |
| **Stage** | Ordered lifecycle step (New → … → Won/Lost). |
| **Activity** | Logged interaction: call, email, meeting, task, note. |
| **Pipeline** | View of leads grouped by stage. |
| **Geofence** | Virtual perimeter around a lat/long; enter/exit events drive arrival/departure times. |
| **Account** | Post-sale customer record spawned from a won lead (future). |
| **Client / Customer** | Business party in CRM; maps to ERP *Debtor/Customer* master when integrated. |
| **Quotation** | Sales quote document in WizCRM; syncs to ERP quote/sales order per connector rules. |
| **ScaleGate** | External cloud service (WIZAG) that issues and validates **licenses** and plan entitlements for commercial use of WizCRM. |
| **License** | Entitlement record from ScaleGate (plan, seats, expiry, feature flags) consumed by WizCRM over API. |
| **ERP connector** | Pluggable integration adapter (SAGE, SAP B1, QuickBooks, Tally, etc.). |

---

## 2. Stakeholders and users

| Role | Goals |
|------|--------|
| **Sales user** | Manage own leads, log activities, attend meetings, close deals. |
| **Sales manager** | Monitor team pipeline, reassign leads, run reports, verify field attendance. |
| **Administrator** | Configure stages, sources, users, geofence defaults, permissions. |
| **System** | Audit trail, notifications, background geofence and call-detection hooks. |

---

## 3. System context

```
┌─────────────┐     ┌─────────────┐
│  web/       │     │  mobile/    │
│  (browser)  │     │  (Expo RN)  │
└──────┬──────┘     └──────┬──────┘
       │                   │
       └─────────┬─────────┘
                 │ HTTPS / REST (+ WebSocket optional)
                 ▼
         ┌───────────────────────────────────┐
         │  WizCRM API + DB (multi-tenant)   │
         │  tenant_id on all tenant data     │
         └───────────┬───────────┬───────────┘
                     │           │
         ┌───────────▼───┐   ┌───▼────────────────────────────┐
         │  ScaleGate    │   │  ERP / Accounting (per tenant) │
         │  License API  │   │  SAGE Evolution 200, SAP B1,  │
         │               │   │  QuickBooks, Tally, …          │
         └───────────────┘   └────────────────────────────────┘
```

**Repository layout:** `web/`, `mobile/`, `shared/`, `docker/` (when added). Active Git branch: `development`.

**Commercial model:** WizCRM is deployed as **multi-tenant SaaS**. Each tenant’s subscription and license are **not** stored as the source of truth inside WizCRM; they are **validated via ScaleGate API** (Section 5).

---

## 4. Multi-tenant SaaS platform

**Epic ID:** FR-MT-001  
**Priority:** Design from Phase 1 (schema + API); full tenant admin UI Phase 4–5.  
**Goal:** One WizCRM deployment serves many customer organizations with strict data isolation and per-tenant configuration.

### 4.1 Tenancy model

| ID | Requirement |
|----|-------------|
| FR-MT-001 | Every business entity (lead, activity, meeting, quotation, user membership, settings) SHALL include **`tenant_id`** (UUID or stable slug). |
| FR-MT-002 | API and database queries SHALL **always** filter by authenticated user’s `tenant_id` (defense in depth: ORM middleware + DB row-level security where supported). |
| FR-MT-003 | Cross-tenant access SHALL be impossible except for a documented **platform super-admin** role (WIZAG operations only). |
| FR-MT-004 | Tenant record: name, slug/subdomain, status (`active`, `suspended`, `trial`), created_at, ScaleGate `license_id` or org key, timezone, default currency. |

### 4.2 Tenant routing and provisioning

| ID | Requirement |
|----|-------------|
| FR-MT-005 | Web: resolve tenant by **subdomain** (`{slug}.wizcrm.app`) and/or **tenant slug** at login; exact URL strategy TBD at implementation. |
| FR-MT-006 | Mobile: tenant context from login response (tenant slug + API base URL); stored securely on device. |
| FR-MT-007 | **Provision tenant** workflow: create tenant row + first admin user; trigger ScaleGate license bind (FR-SG-003). |
| FR-MT-008 | Suspend tenant: read-only or block login when ScaleGate reports invalid/expired license (FR-SG-005). |

### 4.3 Per-tenant configuration

| ID | Requirement |
|----|-------------|
| FR-MT-009 | Per-tenant: stages, sources, loss reasons, geofence defaults, call-prompt settings, branding (logo, primary color). |
| FR-MT-010 | Per-tenant: ERP connector configuration (which system, credentials reference, field maps) — Section 16. |
| FR-MT-011 | Per-tenant: feature flags derived from ScaleGate plan (FR-SG-004) e.g. geofence, ERP sync, seat count. |

### 4.4 Users and membership

| ID | Requirement |
|----|-------------|
| FR-MT-012 | User MAY belong to **multiple tenants** (consultant scenario) with tenant switcher in UI. |
| FR-MT-013 | Roles (Sales, Manager, Admin) are **scoped per tenant**. |
| FR-MT-014 | Enforce **seat limit** from ScaleGate license before inviting new users (FR-SG-006). |

### 4.5 Data lifecycle

| ID | Requirement |
|----|-------------|
| FR-MT-015 | Tenant admin MAY export all tenant data (GDPR / offboarding). |
| FR-MT-016 | Tenant delete / purge workflow with cooling-off period (platform admin). |
| FR-MT-017 | Usage metering hooks: active users, lead count, API calls — expose metrics for ScaleGate billing integration (optional payload to ScaleGate API). |

### 4.6 Acceptance criteria (multi-tenant)

- [ ] Two test tenants cannot read each other’s leads via API or UI.
- [ ] All integration tests use explicit `tenant_id`.
- [ ] New environments support creating a tenant + admin in one flow.

---

## 5. Commercial licensing (ScaleGate API)

**Epic ID:** FR-SG-001  
**Priority:** Phase 5 (commercialization); **stub/provision** in API from Phase 1 (config + no-op dev mode).  
**External system:** **ScaleGate** — separate WIZAG cloud service; API base URL and credentials via environment config.

> **Note:** ScaleGate API contract (endpoints, payloads, auth) will be defined by the ScaleGate product. WizCRM SHALL implement an internal **`LicenseService`** abstraction so ScaleGate can be mocked in dev/tests.

### 5.1 Integration principles

| ID | Requirement |
|----|-------------|
| FR-SG-001 | WizCRM SHALL **not** be the system of record for subscriptions; ScaleGate is. |
| FR-SG-002 | On login and on a schedule, WizCRM SHALL call ScaleGate to **validate license** for the tenant. |
| FR-SG-003 | Store last validation result locally: `valid`, `plan_id`, `features[]`, `seats`, `expires_at`, `grace_until`, `raw_response` (audit). |
| FR-SG-004 | Map ScaleGate **plan / feature codes** to WizCRM capabilities (see FR-MT-011). |

### 5.2 License check flows

| ID | Requirement |
|----|-------------|
| FR-SG-005 | **Web:** block login or show renewal screen if license invalid (after grace). |
| FR-SG-006 | **Mobile:** check on app launch and session refresh; cached license TTL max 24 h (configurable). |
| FR-SG-007 | **API:** middleware rejects mutating requests if tenant license invalid (reads may be allowed in grace — configurable). |
| FR-SG-008 | **Background job:** re-validate all active tenants every N hours; alert ops on repeated failures. |

### 5.3 Entitlements (examples — finalize with ScaleGate)

| Feature code (example) | WizCRM behavior |
|------------------------|-----------------|
| `core_crm` | Leads, pipeline, activities |
| `field_geofence` | FR-GEO-* |
| `call_prompt` | FR-CAL-* |
| `erp_sync` | FR-ERP-* |
| `seats_N` | Max N active users |

### 5.4 Grace and offline

| ID | Requirement |
|----|-------------|
| FR-SG-009 | **Grace period:** if ScaleGate unreachable, use cached license until `grace_until`; then read-only mode. |
| FR-SG-010 | Mobile offline: use cached entitlements; block features not in cache if expired. |
| FR-SG-011 | Admin UI: display license status, plan name, renewal date, link to ScaleGate customer portal (URL from config). |

### 5.5 Security

| ID | Requirement |
|----|-------------|
| FR-SG-012 | ScaleGate API keys stored in secrets manager / env, not in repo. |
| FR-SG-013 | Mutual TLS or signed requests if ScaleGate requires (TBD). |
| FR-SG-014 | Log license checks without logging secrets or full PII. |

### 5.6 Configuration (provision in codebase)

| Setting | Description |
|---------|-------------|
| `SCALEGATE_API_BASE_URL` | ScaleGate REST base URL |
| `SCALEGATE_API_KEY` / client credentials | Service-to-service auth |
| `SCALEGATE_TENANT_ORG_KEY` | Mapping WizCRM `tenant_id` ↔ ScaleGate organization |
| `LICENSE_CHECK_INTERVAL_HOURS` | Default 6 |
| `LICENSE_DEV_MODE` | `true` = skip remote check, all features on |

### 5.7 Acceptance criteria (ScaleGate)

- [ ] `LicenseService` interface with mock implementation for local dev.
- [ ] Production path calls ScaleGate (or feature-flagged stub until API doc delivered).
- [ ] Expired license prevents create/update leads; message directs user to renew via ScaleGate.
- [ ] Seat invite blocked when `active_users >= licensed_seats`.

### 5.8 ScaleGate API (placeholder)

When ScaleGate API documentation is available, extend this section with:

- Authentication method  
- Endpoints: validate license, get entitlements, report usage (optional)  
- Request/response JSON schemas  
- Error codes and retry policy  

---

## 6. Functional requirements — foundation

### FR-FND-001 — Authentication

- Users SHALL sign in with email/password or SSO (SSO = nice-to-have, Phase 4).
- Sessions SHALL expire per security policy; refresh or re-login required.
- Sign out SHALL invalidate client tokens.

### FR-FND-002 — Authorization roles

| Role | Capabilities |
|------|----------------|
| **Sales** | CRUD on assigned leads; create leads; log activities; read team leads if enabled by admin. |
| **Manager** | All team leads; reassign; reports; override attendance flags. |
| **Admin** | Users, teams, stages, sources, system settings, geofence defaults. |

### FR-FND-003 — User profile

- Display name, email, phone, team, avatar (optional).
- Notification preferences (push, email digests).

### FR-FND-004 — Shared API contract

- REST (or GraphQL) API documented for web and mobile.
- Shared TypeScript types in `shared/` for lead, stage, activity, meeting, call-log, **tenant**, **quotation**, **erp link** entities.
- All tenant-scoped routes SHALL require `tenant_id` from auth context (FR-MT-002).

### FR-FND-005 — Audit log

- SHALL record: entity type, id, action, user, timestamp, before/after snapshot or diff for critical fields.

### FR-FND-006 — Mobile offline (basic)

- SHALL cache recently viewed leads and pending activity drafts.
- SHALL sync when connectivity returns; surface conflicts to user.

---

## 7. Functional requirements — leads and lifecycle

*Stage definitions and transition rules: [LEAD_LIFECYCLE.md](./LEAD_LIFECYCLE.md).*

### FR-LED-001 — Create lead

**Required fields:** name (person or company), at least one of email/phone, source, owner (default: creator).  
**Optional:** company, industry, size, budget, expected close date, tags, custom fields.

**Acceptance criteria:**

- Validation errors shown inline.
- Duplicate warning if email or phone matches existing lead (FR-LED-005).

### FR-LED-002 — Lead list

- Paginated list with search (name, company, email, phone).
- Filters: stage, owner, source, created date, last activity, stale flag.
- Sort: name, created, last activity, stage.

### FR-LED-003 — Lead detail

- Show all fields, current stage, owner, timeline preview, next task, linked meetings.

### FR-LED-004 — Edit / delete lead

- Edit with audit; delete or archive per role (soft delete preferred).

### FR-LED-005 — Duplicate detection

- On create/import: match on normalized email and E.164 phone; show merge or proceed.

### FR-LED-006 — Assign / reassign owner

- Manager or admin can reassign; sales can reassign own if policy allows.
- Timeline event: “Ownership changed from A to B”.

### FR-LED-007 — Stage change

- User selects new stage; optional note required for backward moves (configurable).
- System writes **stage history**: previous, new, user, timestamp, note.

### FR-LED-008 — Pipeline view

- Kanban (web + mobile simplified) or list grouped by stage.
- Drag-drop stage change on web (optional mobile).

### FR-LED-009 — Close Won

- Terminal for sales pipeline.
- Capture: contract value (optional), start date, products/services (optional).
- Optional: spawn **Account** (FR-ACC-001).

### FR-LED-010 — Close Lost

- Require or strongly encourage loss reason: Price, Timing, Competitor, No budget, Unresponsive, Not a fit, Other (+ text).

### FR-LED-011 — Reopen lost lead

- Explicit action only; audit note; return to selected non-terminal stage.

### FR-LED-012 — Stale leads

- Admin configures **N** days without activity.
- Highlight in list and dashboard; filter “stale only”.

### FR-LED-013 — Configurable stages (admin)

- Default set: New, Contacted, Qualified, Proposal, Negotiation, Won, Lost.
- Admin may rename/disable non-system stages; Won/Lost remain terminal.

---

## 8. Functional requirements — post-call lead attachment (mobile)

**ID:** FR-CAL-001 (epic)  
**Priority:** Phase 2 (high value for field sales)  
**Platforms:** Mobile primary; web shows linked call activities on timeline.

### 6.1 Problem statement

After a phone call ends, reps often forget to log the interaction against the correct lead. WizCRM SHALL prompt the user to attach the call to a lead and capture minimal activity data in one flow.

### 6.2 Triggers

| ID | Trigger | Platform notes |
|----|---------|----------------|
| FR-CAL-001a | Outbound call initiated from app (tap-to-call) | Reliable; recommended primary path. |
| FR-CAL-001b | Call ends after device returns to app / foreground | Heuristic when OS allows. |
| FR-CAL-001c | Call log entry detected (ended) | Android: `READ_CALL_LOG` + policy justification; iOS: limited—fallback. |
| FR-CAL-001d | User taps “Log recent call” from home or lead list | Manual fallback all platforms. |

### 6.3 User flow

1. Call ends (or user opens prompt).
2. Modal / bottom sheet: **“Log this call to a lead?”**
3. Actions:
   - **Search lead** (recent leads, then full search).
   - **Create new lead** (prefill phone from call if available).
   - **Skip** — optional reason: Not sales / Wrong number / Later.
4. Quick log form:
   - Type: **Call** (fixed).
   - Phone number (read-only if from call log).
   - Direction: inbound / outbound.
   - Duration (seconds, from call log or editable).
   - Outcome: Connected, Voicemail, No answer, Busy, Wrong number.
   - Note (text; voice-to-text = nice-to-have).
   - Optional: **Move to stage**, **Schedule follow-up task**.
5. Save → activity on lead timeline; clear “unlinked call” if any.

### 6.4 Settings

| Setting | Options |
|---------|---------|
| Prompt mode | Always / Unknown numbers only / Off |
| Auto-open after outbound from app | On / Off |

### 6.5 Data model (call activity)

| Field | Type | Notes |
|-------|------|-------|
| `id` | UUID | |
| `lead_id` | UUID | Nullable until linked |
| `user_id` | UUID | |
| `phone_number` | string | E.164 |
| `direction` | enum | in, out |
| `started_at` | datetime | |
| `ended_at` | datetime | |
| `duration_seconds` | int | |
| `outcome` | enum | See 6.3 |
| `note` | text | |
| `linked_automatically` | bool | |
| `device_call_id` | string | Optional, dedupe |

### 6.6 Reporting

- FR-CAL-002: Dashboard widget “Unlinked calls (7 days)”.
- FR-CAL-003: Report calls logged vs detected (manager).

### 6.7 Non-functional / compliance

- Play Store and App Store privacy declarations for call log / phone state if used.
- User consent screen on first use of call detection.
- Do not upload full call recording without explicit separate consent.

### 6.8 Acceptance criteria

- [ ] After outbound call from lead detail, prompt appears within 5 s of return to app.
- [ ] User can link call to lead in ≤ 4 taps (search recent + confirm).
- [ ] Timeline shows call with duration and outcome.
- [ ] Skip does not create activity; optional audit event only.

---

## 9. Functional requirements — meeting geofence attendance

**ID:** FR-GEO-001 (epic)  
**Priority:** Phase 3  
**Platforms:** Mobile (geofence), web (create meeting, map, reports).

### 7.1 Problem statement

For field meetings, the organization needs reliable **attendance**, **arrival time**, and **departure time** without manual clock-in. The meeting destination is set in advance; the app registers a geofence of **X** meters; entering/exiting records times.

### 7.2 Meeting setup (before event)

Created on lead as activity type **Meeting**:

| Field | Required | Description |
|-------|----------|-------------|
| `title` | Yes | e.g. “Site visit — Acme Corp” |
| `lead_id` | Yes | |
| `assigned_user_ids` | Yes | One or more attendees |
| `scheduled_start` | Yes | Planned start (timezone-aware) |
| `scheduled_end` | Yes | Planned end |
| `location_address` | Recommended | Human-readable |
| `latitude`, `longitude` | Yes | Geocode from address or map pin |
| `geofence_radius_meters` | Yes | Default **X** from org settings (e.g. 150 m) |
| `notes` | No | |

**FR-GEO-001a:** Web and mobile SHALL allow picking location on map.  
**FR-GEO-001b:** “Navigate” opens external maps app with destination.

### 7.3 Geofence registration

- When meeting is **confirmed** and within configurable window (e.g. 24 h before start until end + buffer), mobile app registers OS geofence(s) for assigned user.
- Radius = `geofence_radius_meters` (admin default **X**, overridable per meeting).
- Maximum concurrent geofences per OS limits respected (priority queue for nearest meetings).

### 7.4 Enter / exit behaviour

| Event | System action |
|-------|----------------|
| **Enter** geofence | Set `arrived_at` = first qualified enter timestamp; `arrival_source` = `geofence` |
| **Exit** geofence | Set `left_at` = exit timestamp; `departure_source` = `geofence` |
| **On-site duration** | `left_at - arrived_at` when both set |

**Debouncing (FR-GEO-002):**

- Must remain inside radius for **T_enter** seconds (default 60) before arrival counts.
- Exit must be outside for **T_exit** seconds (default 120) before departure counts.
- Reduces GPS bounce at boundary.

### 7.5 Attendance rules

Configurable by admin:

| Status | Rule (example) |
|--------|----------------|
| **On time** | `arrived_at` ≤ `scheduled_start` + grace (default 15 min) |
| **Late** | Arrived after grace |
| **No show** | No `arrived_at` before `scheduled_end` |
| **Partial** | Arrived but `left_at` before `scheduled_end` − grace |
| **Inferred departure** | No exit event; close at `scheduled_end` with flag |

**FR-GEO-003:** Manager can **manual override** arrival/departure with reason (audit).

### 7.6 Edge cases

| Case | Handling |
|------|----------|
| GPS denied | Prompt enable; fallback manual check-in/out buttons |
| Poor GPS indoors | Increase radius or manual confirm inside fence |
| App killed | OS geofence if supported; else gap flagged |
| Never entered | No show |
| Multiple meetings same site | Smaller radius or user selects which meeting on enter |
| User arrives day early | Arrival recorded; report shows early vs scheduled |

### 7.7 Privacy and permissions

- Explicit consent for background location (FR-GEO-004).
- Indicator when location tracking active for a meeting.
- Optional: tracking only during meeting window (start − 1 h to end + 1 h).
- Privacy policy and data retention for lat/long (store event times; raw track optional).

### 7.8 Data model (meeting attendance)

| Field | Type |
|-------|------|
| `meeting_id` | UUID |
| `lead_id` | UUID |
| `latitude`, `longitude` | decimal |
| `geofence_radius_meters` | int |
| `scheduled_start`, `scheduled_end` | datetime |
| `arrived_at`, `left_at` | datetime nullable |
| `arrival_source`, `departure_source` | enum: geofence, manual, inferred |
| `on_site_duration_seconds` | int computed |
| `attendance_status` | enum: on_time, late, no_show, partial, in_progress, inferred |
| `override_by`, `override_reason` | optional |

Timeline events: “Arrived at meeting location”, “Left meeting location”.

### 7.9 Reporting

- FR-GEO-005: Meeting list with attendance columns.
- FR-GEO-006: Export CSV: lead, user, scheduled vs actual times, duration on site.

### 7.10 Acceptance criteria

- [ ] Admin sets default radius X; meeting inherits unless overridden.
- [ ] Enter/exit within test harness produces correct `arrived_at` / `left_at`.
- [ ] Lead timeline shows geofence events.
- [ ] Manual override requires manager role and audit note.

---

## 10. Functional requirements — activities and timeline

### FR-ACT-001 — Timeline per lead

Combines: stage changes, activities, system events, geofence events, call logs.

### FR-ACT-002 — Activity types (v1)

Call, Email, Meeting, Task, Note (internal).

### FR-ACT-003 — Log call (manual)

Same fields as FR-CAL quick log without auto-detect.

### FR-ACT-004 — Log email

Subject, body/summary, date, direction (in/out).

### FR-ACT-005 — Log meeting

Scheduling fields; links to FR-GEO when location set.

### FR-ACT-006 — Tasks / reminders

Due date, assignee, complete/cancel; notify when due (FR-NOT-001).

### FR-ACT-007 — Notes

Internal only; @mentions = nice-to-have.

### FR-ACT-008 — Next action field

Optional “next step” + date on lead; shown on dashboard.

---

## 11. Functional requirements — dashboards and reporting

### FR-RPT-001 — My dashboard

Open leads count, tasks due today, stale leads, upcoming meetings.

### FR-RPT-002 — Manager dashboard

Team pipeline snapshot, unlinked calls, attendance exceptions.

### FR-RPT-003 — Conversion metrics

By stage, source, owner, date range.

### FR-RPT-004 — Time in stage

Average/median duration per stage.

### FR-RPT-005 — Win/loss analytics

By reason and source.

### FR-RPT-006 — Export CSV

Leads and activities filterable export.

### FR-RPT-007 — Saved views

User-saved filter presets.

---

## 12. Functional requirements — web administration

### FR-WEB-001 — Bulk CSV import leads

### FR-WEB-002 — Bulk assign / stage change

### FR-WEB-003 — Manage users and teams

### FR-WEB-004 — Configure sources, stages, loss reasons

### FR-WEB-005 — Custom fields (admin-defined)

### FR-WEB-006 — System settings

Stale days, geofence default X, grace minutes, call prompt defaults.

---

## 13. Functional requirements — mobile UX

### FR-MOB-001 — Push notifications

Task due, assignment, stage change, meeting reminder.

### FR-MOB-002 — Tap-to-call / email from lead

### FR-MOB-003 — Add lead from mobile

### FR-MOB-004 — Biometric app unlock (nice-to-have, Phase 4)

### FR-MOB-005 — Compact pipeline view

### FR-MOB-006 — Expo / dev build path documented in MOBILE_DEV.md

---

## 14. Functional requirements — integrations and automation (Phase 4+)

| ID | Feature |
|----|---------|
| FR-INT-001 | Public web form → create lead |
| FR-INT-002 | Email mailbox sync (optional) |
| FR-INT-003 | Calendar sync (Google / Microsoft) |
| FR-INT-004 | Webhooks outbound on lead/stage events |
| FR-INT-005 | Rule engine: auto-assign by source, stale reminders |
| FR-INT-006 | Slack / Teams notifications |

---

## 15. Functional requirements — ERP and accounting integrations

**Epic ID:** FR-ERP-001  
**Priority:** Phase 6 (after core CRM + tenant + license); connector implementations when vendor **SDK/API documentation** is supplied.  
**Goal:** Keep **clients/customers** and **quotations** consistent between WizCRM and each tenant’s ERP/accounting system.

### 15.1 Supported systems (provision)

WizCRM SHALL support a **pluggable connector** model. Initial target systems (implement when APIs/SDKs provided):

| System | Notes |
|--------|--------|
| **SAGE Evolution 200** | South Africa / regional deployments common |
| **SAP Business One (SAP B1)** | DI API / Service Layer — connector TBD |
| **QuickBooks** | Online (and optionally Desktop) — OAuth2 |
| **Tally** | TallyPrime integration — XML/ODBC/SDK per vendor doc |

| ID | Requirement |
|----|-------------|
| FR-ERP-001 | **Connector framework:** interface `ErpConnector` with capabilities: `testConnection`, `syncCustomers`, `syncQuotations`, `pullCustomers`, `pushQuotation`, `mapFields`. |
| FR-ERP-002 | One **active connector per tenant** (v1); architecture allows multiple in future. |
| FR-ERP-003 | Connector registry in admin UI: install/enabled state per ERP type. |

### 15.2 Customer / client sync

| ID | Requirement |
|----|-------------|
| FR-ERP-010 | **Entity mapping:** WizCRM Lead/Account ↔ ERP Customer/Debtor with `external_id`, `erp_system`, `last_synced_at`, `sync_direction`. |
| FR-ERP-011 | **Push:** Create/update ERP customer when lead reaches defined stage (e.g. Qualified or Won) or on manual “Sync to ERP”. |
| FR-ERP-012 | **Pull:** Import new/updated ERP customers as leads or accounts (admin maps default stage/source). |
| FR-ERP-013 | **Bidirectional:** Field-level mapping config per tenant (name, tax id, address, phone, email, credit limit, etc.). |
| FR-ERP-014 | **Conflict policy:** configurable — ERP wins, WizCRM wins, or flag for manual merge. |
| FR-ERP-015 | Duplicate prevention via `external_id` + tax registration number where available. |

### 15.3 Quotation sync

| ID | Requirement |
|----|-------------|
| FR-ERP-020 | WizCRM SHALL support **Quotations** (header + line items: product, qty, unit price, discount, tax). |
| FR-ERP-021 | **Push quotation** from WizCRM to ERP as draft quote/sales quotation (ERP-specific document type). |
| FR-ERP-022 | Store ERP document number and status on WizCRM quotation (`external_quote_id`, `erp_status`). |
| FR-ERP-023 | Optional **pull status** updates from ERP (accepted, rejected, converted to order). |
| FR-ERP-024 | Link quotation to **lead** and, when synced, to **ERP customer** `external_id`. |
| FR-ERP-025 | PDF generation in WizCRM optional; ERP may remain authoritative for printed quote. |

### 15.4 Sync operations

| ID | Requirement |
|----|-------------|
| FR-ERP-030 | **Scheduled sync** (cron per tenant): interval configurable (e.g. 15 min, 1 h, nightly). |
| FR-ERP-031 | **Manual sync** button for admin: full or per-entity. |
| FR-ERP-032 | **Sync job queue** with retries, exponential backoff, dead-letter log. |
| FR-ERP-033 | **Sync audit log:** timestamp, direction, entity, success/failure, error message, payload reference. |
| FR-ERP-034 | Notify admin on repeated sync failure (email/push). |

### 15.5 Connection and security

| ID | Requirement |
|----|-------------|
| FR-ERP-040 | Per-tenant credentials stored in **secrets vault** (encrypted at rest); never returned to client after save. |
| FR-ERP-041 | **Test connection** in admin UI before enabling sync. |
| FR-ERP-042 | OAuth flows (QuickBooks etc.) with refresh token rotation. |
| FR-ERP-043 | ERP sync disabled automatically if tenant license lacks `erp_sync` (ScaleGate FR-SG-004). |

### 15.6 Product / item master (optional v2)

| ID | Requirement |
|----|-------------|
| FR-ERP-050 | Cache ERP item catalog for quotation line picker (SKU, description, price). |
| FR-ERP-051 | Periodic refresh of price lists from ERP. |

### 15.7 Implementation provision (before SDKs)

| ID | Requirement |
|----|-------------|
| FR-ERP-060 | Codebase folder e.g. `integrations/erp/` with `base` module + stub adapters: `sage-evolution`, `sap-b1`, `quickbooks`, `tally` throwing `NotImplemented` until SDK wired. |
| FR-ERP-061 | OpenAPI/webhook endpoints reserved: `/tenants/{id}/erp/webhook` for ERP callbacks. |
| FR-ERP-062 | Database tables provisioned: `erp_connections`, `erp_entity_links`, `quotations`, `quotation_lines`, `erp_sync_logs`. |

### 15.8 Acceptance criteria (ERP)

- [ ] Tenant can save ERP connection config (stub mode logs “not implemented”).
- [ ] Field mapping UI saves JSON map per tenant per connector type.
- [ ] Manual “Sync customer” enqueues job; audit log row created.
- [ ] Quotation created in WizCRM appears in sync queue with correct line items.
- [ ] When first real SDK is integrated, only adapter module changes—not core CRM.

### 15.9 Vendor documentation (to be supplied)

For each ERP, product owner will provide SDK/API docs. SRS will be updated with:

- Authentication  
- Customer create/update endpoints  
- Quotation/sales document endpoints  
- Rate limits and sandbox URLs  

---

## 16. Functional requirements — post-sale accounts

### FR-ACC-001 — Convert won lead to Account

Customer record; link back to original lead.

### FR-ACC-002 — Account timeline

Continued activities post-sale.

### FR-ACC-003 — Renewal / upsell tracking

---

## 17. Nice-to-have features (full specification)

Nice-to-have items are **not required for MVP** but are fully specified here for prioritization. Each has ID `FR-NTH-*`.

### 17.1 UX and personalization

| ID | Feature | Description | Acceptance hint |
|----|---------|-------------|-----------------|
| FR-NTH-001 | Dark / light theme | User or system setting; persist per device. | All main screens respect theme. |
| FR-NTH-002 | Customizable home | User orders widgets: tasks, pipeline, stale. | Drag reorder saved. |
| FR-NTH-003 | Pinned leads | Quick access list. | Pin/unpin from detail. |
| FR-NTH-004 | Recent searches | Last 10 searches. | Tap to re-run. |
| FR-NTH-005 | Haptic feedback | On stage change, task complete. | Toggle in settings. |
| FR-NTH-006 | Accessibility | Dynamic type, screen reader labels, contrast. | WCAG 2.1 AA target on web. |

### 17.2 Collaboration

| ID | Feature | Description |
|----|---------|-------------|
| FR-NTH-010 | @mention in notes | Notify user; deep link to lead. |
| FR-NTH-011 | Lead thread chat | Internal messages per lead, not SMS to customer. |
| FR-NTH-012 | Handoff checklist | Template when reassigning owner. |
| FR-NTH-013 | Shared team views | Manager publishes filter to team. |
| FR-NTH-014 | Activity feed | Global “team updates” stream. |

### 17.3 Documents

| ID | Feature | Description |
|----|---------|-------------|
| FR-NTH-020 | File attachments | PDF/images on lead; size limits. |
| FR-NTH-021 | Document templates | Merge fields from lead. |
| FR-NTH-022 | E-signature integration | DocuSign / similar webhook. |
| FR-NTH-023 | Business card scan | OCR → draft lead. |

### 17.4 Communication

| ID | Feature | Description |
|----|---------|-------------|
| FR-NTH-030 | Email templates | Variables: {{name}}, {{company}}. |
| FR-NTH-031 | SMS / WhatsApp log | Manual log or API integration. |
| FR-NTH-032 | Voicemail link | URL in call activity. |

### 17.5 Intelligence (AI)

| ID | Feature | Description |
|----|---------|-------------|
| FR-NTH-040 | Timeline summary | LLM summary of last N activities. |
| FR-NTH-041 | Suggested next action | From stage + stale rules + ML later. |
| FR-NTH-042 | Lead scoring | 0–100; configurable weights. |
| FR-NTH-043 | Sentiment on notes | Optional tag positive/negative/neutral. |
| FR-NTH-044 | Voice note → activity | Transcribe and structure fields. |

### 17.6 Productivity

| ID | Feature | Description |
|----|---------|-------------|
| FR-NTH-050 | Snooze lead | Hide until datetime. |
| FR-NTH-051 | Web keyboard shortcuts | j/k navigate, / search. |
| FR-NTH-052 | Calendar week view | Meetings + tasks. |
| FR-NTH-053 | Working hours DND | Suppress non-urgent push outside hours. |

### 17.7 Integrations (extended)

| ID | Feature | Description |
|----|---------|-------------|
| FR-NTH-060 | Contact sync | Device contacts ↔ leads (opt-in). |
| FR-NTH-061 | Accounting export | Superseded by FR-ERP-* when connector enabled; else manual export. |
| FR-NTH-062 | Marketing handoff | Webhook to HubSpot-style systems. |

### 17.8 Reporting (extended)

| ID | Feature | Description |
|----|---------|-------------|
| FR-NTH-070 | Report builder | User-defined columns and charts. |
| FR-NTH-071 | Scheduled email reports | Cron weekly PDF/CSV. |
| FR-NTH-072 | Quotas and goals | Target vs actual per rep. |
| FR-NTH-073 | Weighted forecast | By stage probability. |

### 17.9 Mobile extended

| ID | Feature | Description |
|----|---------|-------------|
| FR-NTH-080 | Home screen widget | Tasks due today. |
| FR-NTH-081 | Wear OS / Watch | Next task glance. |
| FR-NTH-082 | Share lead PDF | Internal summary export. |
| FR-NTH-083 | Driving mode | Voice-only logging; minimal UI. |
| FR-NTH-084 | Arrival photo | Optional camera proof at geofence enter. |

### 17.10 Enterprise and trust

| ID | Feature | Description |
|----|---------|-------------|
| FR-NTH-090 | SSO SAML/OIDC | Enterprise IdP. |
| FR-NTH-091 | 2FA TOTP | Optional per org. |
| FR-NTH-092 | IP allowlist (web) | Admin CIDR list. |
| FR-NTH-093 | Data retention job | Auto-archive leads older than N years. |
| FR-NTH-094 | Encrypt sensitive notes | Field-level at rest. |

### 17.11 Gamification

| ID | Feature | Description |
|----|---------|-------------|
| FR-NTH-100 | Leaderboard | Calls logged, meetings attended, deals won. |
| FR-NTH-101 | Badges | Milestones; opt-out for org. |

### 17.12 Geofence extensions

| ID | Feature | Description |
|----|---------|-------------|
| FR-NTH-110 | Map draw geofence (web) | Circle editor when creating meeting. |
| FR-NTH-111 | Visitor log export | Compliance PDF per meeting. |

---

## 18. Non-functional requirements

| ID | Requirement |
|----|-------------|
| NFR-001 | **Availability:** 99.5% monthly for production API (target). |
| NFR-002 | **Performance:** Lead list p95 &lt; 2 s for 10k leads per org. |
| NFR-003 | **Security:** HTTPS only; OWASP top 10 mitigations; hash passwords (bcrypt/argon2). |
| NFR-004 | **Privacy:** GDPR-ready export/delete for contact data. |
| NFR-005 | **Mobile battery:** Geofence using OS-efficient APIs; no continuous GPS unless in active navigation. |
| NFR-006 | **Multi-tenancy:** `tenant_id` on all tenant data; isolation verified by automated tests; no shared cache keys across tenants. |
| NFR-010 | **License dependency:** Core API degrades gracefully when ScaleGate unavailable (FR-SG-009). |
| NFR-011 | **ERP sync:** Async workers; no blocking HTTP request > 30 s for full sync; idempotent jobs. |
| NFR-007 | **Observability:** Structured logs, error tracking (Sentry or equivalent). |
| NFR-008 | **i18n:** English first; strings externalized for future locales. |
| NFR-009 | **Accessibility:** Mobile TalkBack / VoiceOver on primary flows. |

---

## 19. Implementation phases (roadmap)

| Phase | Focus | Key requirement IDs |
|-------|--------|---------------------|
| **1 — MVP** | Auth, leads, stages, pipeline, manual activities, Won/Lost; **`tenant_id` in schema** | FR-FND-*, FR-LED-*, FR-ACT-001–008, FR-MT-001–004 |
| **2 — Field sales** | Post-call prompt, meetings (no geofence), tasks, notifications | FR-CAL-*, FR-ACT-005, FR-MOB-*, FR-NOT-* |
| **3 — Attendance** | Geofence enter/exit, attendance rules, reports | FR-GEO-* |
| **4 — Scale** | Web admin, reporting, general integrations | FR-WEB-*, FR-RPT-*, FR-INT-* |
| **5 — Commercial SaaS** | Full multi-tenant admin, **ScaleGate license** enforcement | FR-MT-*, FR-SG-* |
| **6 — ERP** | Connector framework, customer + quotation sync (per SDK) | FR-ERP-* |
| **7 — Nice-to-have** | Per priority from backlog | FR-NTH-* |

---

## 20. Traceability

- **Progress:** [PROGRESS_TRACKER.md](./PROGRESS_TRACKER.md) — checkbox per requirement ID.
- **Domain model detail:** [LEAD_LIFECYCLE.md](./LEAD_LIFECYCLE.md).
- **Mobile toolchain:** [MOBILE_DEV.md](./MOBILE_DEV.md).

---

## 21. Document history

| Version | Date | Author | Changes |
|---------|------|--------|---------|
| 1.0 | 2026-05-17 | WizCRM / AI-assisted | Initial SRS including post-call, geofence, nice-to-haves |
| 1.1 | 2026-05-17 | WizCRM / AI-assisted | Multi-tenant SaaS, ScaleGate licensing API, ERP integrations (SAGE, SAP B1, QuickBooks, Tally) |
