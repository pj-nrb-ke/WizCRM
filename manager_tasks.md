# WizCRM — Manager and non-technical tasks

Tasks listed here are **outside the codebase**: accounts, legal, vendor access, product decisions, and operations. Engineering cannot complete them.

**Product tiers:** **Lite** (internal, ~1 week) · **Pro** (~1 month) · **Enterprise** (full platform). See [SRS.md](./SRS.md) and [WizCRM Features.md](./WizCRM%20Features.md).

**Track status in:** [manager_task_tracker.md](./manager_task_tracker.md)  
**Related:** [SRS.md](./SRS.md), [PROGRESS_TRACKER.md](./PROGRESS_TRACKER.md) (`TOOL-*`)

**Legend for owners:** Product = business/product owner · Legal = counsel or delegated · IT = WIZAG or customer IT · Vendor = external portal signup

---

## 1. Maps and location (Google Maps / geofence)

Required **before geofence beta** and production use of meeting maps.

| ID | Task | Owner | Details |
|----|------|-------|---------|
| **MGT-001** | Create **Google Cloud** organization/project | Product / IT | e.g. project name `WizCRM`. Enable billing (Maps is usage-based; dev often fits free tier/credits). |
| **MGT-002** | Enable required **Google APIs** | IT | Maps SDK for Android, Maps SDK for iOS (when applicable), **Maps JavaScript API** (web), **Geocoding API**. Optional: Directions API for navigation links. |
| **MGT-003** | Create and **restrict API keys** | IT | Separate keys recommended: Android, iOS, web. Restrict by package name + SHA-1 (Android), bundle ID (iOS), HTTP referrer (web). Never commit keys to git. |
| **MGT-004** | Publish **privacy policy** mentioning location | Legal / Product | Must cover background location if geofence is used; link from app and website. |
| **MGT-005** | **Staff consent / policy** for field tracking | Legal / HR / Product | How meeting location tracking is explained to sales reps; regional rules (GDPR, POPIA, etc.). |

**Engineering counterpart:** `TOOL-001`–`TOOL-004`, `TOOL-009` in [PROGRESS_TRACKER.md](./PROGRESS_TRACKER.md).

---

## 2. Commercial SaaS and ScaleGate licensing

Required **before paid multi-tenant launch**. WizCRM validates licenses via **ScaleGate API** (see SRS §5).

| ID | Task | Owner | Details |
|----|------|-------|---------|
| **MGT-006** | Define **subscription plans** | Product | Names, price points, seat limits, included features (core CRM, geofence, call prompt, ERP sync). |
| **MGT-007** | Provide **ScaleGate license API** documentation | Product / ScaleGate team | Endpoints, auth, request/response for validate license and entitlements; error codes; sandbox URL. |
| **MGT-008** | **Map plan codes** to WizCRM features | Product | e.g. `erp_sync`, `field_geofence`, `seats_10` → SRS §5.3 feature flags. |
| **MGT-009** | Define **customer onboarding** flow | Product / Ops | Signup → payment (ScaleGate?) → tenant provision → first admin invite. |
| **MGT-010** | **Terms of Service** and **Data Processing Agreement** | Legal | B2B SaaS terms; subprocessors list (Google, hosting, ScaleGate, etc.). |

**Engineering counterpart:** `FR-SG-*`, `FR-MT-*`, `TOOL-010`.

---

## 3. ERP and accounting integrations

Required **before Phase 6 ERP development** per connector. SDK/API docs to be shared with development when ready.

| ID | Task | Owner | Details |
|----|------|-------|---------|
| **MGT-011** | Set **ERP priority order** | Product | Which first: SAGE Evolution 200, SAP B1, QuickBooks, Tally. |
| **MGT-012** | **SAGE Evolution 200** developer/sandbox access | Product / Vendor | Partner portal, test company, integration method/SDK from Sage. |
| **MGT-013** | **SAP Business One** sandbox | Product / IT / Client | Service Layer URL, test license; often per-customer IT. |
| **MGT-014** | **QuickBooks** Intuit Developer account | Product / IT | Create app, OAuth 2, sandbox company; production approval process. |
| **MGT-015** | **Tally** integration documentation/SDK | Product / Vendor | Provide docs when available (XML/ODBC/SDK per Tally version). |
| **MGT-015b** | Identify **pilot customer** for first ERP | Product | Willing to test customer + quotation sync on sandbox. |

**Engineering counterpart:** `FR-ERP-*`, `TOOL-011`, connector rows in progress tracker.

---

## 4. App stores and public mobile distribution

Required when moving **beyond Expo Go** to store builds.

| ID | Task | Owner | Details |
|----|------|-------|---------|
| **MGT-016** | **Google Play Developer** account | Product | One-time registration fee; use organization account for WIZAG if applicable. |
| **MGT-017** | **Apple Developer Program** | Product | Annual fee; required for iOS App Store and push (APNs). |
| **MGT-018** | **Store listings** | Product / Marketing | App name, description, screenshots, support URL, privacy policy URL. |
| **MGT-019** | **Google Play Data safety** and content rating | Product / Legal | Declare location, phone/call log if used; complete questionnaire. |

**Engineering counterpart:** `TOOL-005`, `TOOL-007`, `TOOL-008`.

---

## 5. Brand, domain, and operations

| ID | Task | Owner | Details |
|----|------|-------|---------|
| **MGT-020** | Register **SaaS domain** and DNS | Product / IT | e.g. `app.wizcrm.com`, tenant subdomains `{slug}.wizcrm.com`. |
| **MGT-021** | **Support** contact and optional status page | Ops | support@ email, help docs, incident communication. |
| **MGT-022** | Confirm default **geofence radius X** (meters) | Product | e.g. 100, 150, 300 m; used as org default in SRS §9. |
| **MGT-023** | Confirm **meeting grace minutes** and attendance rules | Product | Late arrival grace, no-show rules, early leave — SRS §9.5. |

---

## 6. Suggested timeline (manager view)

| When | Complete these IDs |
|------|---------------------|
| **Now (all tiers)** | MGT-011, MGT-022, MGT-023 |
| **Lite internal pilot** | Optional: defer Maps/ScaleGate until Pro |
| **Before Pro launch** | MGT-006 – MGT-010 (ScaleGate + legal) |
| **Before Enterprise geofence** | MGT-001 – MGT-005 |
| **Before Enterprise ERP** | MGT-012 – MGT-015, MGT-015b |
| **Before store release (Pro+)** | MGT-016 – MGT-021 |

---

## 7. Not required for current development

You do **not** need to finish the above before continuing Expo/emulator development today:

- Maps keys (until map/geofence UI is built)
- ScaleGate production API (dev uses `LICENSE_DEV_MODE`)
- ERP sandboxes (until connectors are implemented)
- Play/App Store accounts (Expo Go is sufficient for now)

---

## Related documents

- [SRS.md](./SRS.md) — §20 Technical add-ons, §21 Manager tasks summary  
- [manager_task_tracker.md](./manager_task_tracker.md) — Checkbox status per `MGT-*`  
- [PROGRESS_TRACKER.md](./PROGRESS_TRACKER.md) — Engineering `TOOL-*` and `FR-*`  
- [MOBILE_DEV.md](./MOBILE_DEV.md) — Android emulator and Expo
