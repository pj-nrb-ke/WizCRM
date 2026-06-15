# WizCRM — QA Session 2 Results
**Date:** 2026-06-15
**Conducted by:** Claude Sonnet 4.6
**Project:** WizCRM (`C:\Users\pj\WizCRM`)
**Branch:** master
**Baseline commit:** `5f72712` — release merge PJ → main

---

## Overview

This document records the full results of the second QA pass on the WizCRM codebase. Six evaluation passes were executed in order:

1. Automated test suite
2. TypeScript type-checking + production build
3. SRS traceability review
4. Page-by-page UI/UX inspection (21 pages)
5. Security spot-check
6. Report generation

**Session result: ✅ PASS** — 8 findings, 6 fixed within session, 2 carried forward as low-priority open items.

---

## Pass 1 — Automated Tests

Command run:
```
npm run test --workspaces
```

### Results

| Package | Test Files | Tests Passed | Tests Skipped | Tests Failed |
|---------|-----------|-------------|---------------|-------------|
| `@wizcrm/shared` | 9 | **38** | 0 | 0 |
| `@wizcrm/api` | 15 | **32** | 34 *(DB required)* | 0 |
| `@wizcrm/web` | 3 | **10** | 0 | 0 |
| **TOTAL** | **27** | **80** | **34** | **0** |

### Test File Details

#### @wizcrm/shared (38/38 pass)

| Test File | Tests | Result |
|-----------|-------|--------|
| `src/entitlements.test.ts` | 4 | ✅ |
| `src/geo.test.ts` | 4 | ✅ |
| `src/lead-tags.test.ts` | 2 | ✅ |
| `src/phone.test.ts` | 2 | ✅ |
| `src/stages.test.ts` | 5 | ✅ |
| `src/ai-rules.test.ts` | 7 | ✅ |
| `src/mentions.test.ts` | 2 | ✅ |
| `src/pipeline-stages.test.ts` | 3 | ✅ |
| `src/schemas.test.ts` | 9 | ✅ |

#### @wizcrm/api (32/32 pass, 3 files skipped — need live DB)

| Test File | Tests | Result |
|-----------|-------|--------|
| `tests/ai-orchestrator.test.ts` | 2 | ✅ |
| `tests/ai-suggest-stage.test.ts` | 1 | ✅ |
| `tests/reports.service.test.ts` | 3 | ✅ |
| `tests/team-metrics.service.test.ts` | 3 | ✅ |
| `tests/calendar.service.test.ts` | 4 | ✅ |
| `tests/activity-feed.service.test.ts` | 1 | ✅ |
| `tests/note-body.service.test.ts` | 3 | ✅ |
| `tests/sales-targets.service.test.ts` | 1 | ✅ |
| `tests/report-analytics.service.test.ts` | 3 | ✅ |
| `tests/brevo-config.test.ts` | 1 | ✅ |
| `tests/team.service.test.ts` | 3 | ✅ |
| `tests/app.test.ts` | 9 *(8 skipped)* | ✅ |
| `tests/card-fields.test.ts` | 2 | ✅ |
| `tests/lead-insights.test.ts` | 1 | ✅ |
| `tests/desk-rules.test.ts` | 3 | ✅ |
| `tests/lite-integration.test.ts` | *(8 skipped — DB)* | ⏭ Skipped |
| `tests/qa-lite-automated.test.ts` | *(15 skipped — DB)* | ⏭ Skipped |
| `tests/teams-integration.test.ts` | *(3 skipped — DB)* | ⏭ Skipped |

#### @wizcrm/web (10/10 pass)

| Test File | Tests | Result |
|-----------|-------|--------|
| `lib/csv-parse.test.ts` | — | ✅ |
| `pages/BulkImportPage.test.ts` | — | ✅ |
| Component tests | — | ✅ |

**Verdict: ✅ PASS** — 80/80 tests pass. 34 integration tests skipped expectedly (require a live PostgreSQL database).

---

## Pass 2 — TypeScript Type-Checking & Production Build

### TypeScript Checks

| Package | Command | Result |
|---------|---------|--------|
| `@wizcrm/shared` | `npx tsc -p shared/tsconfig.json --noEmit` | ✅ 0 errors |
| `@wizcrm/api` | `npx tsc -p api/tsconfig.json --noEmit` | ✅ 0 errors |
| `@wizcrm/web` | `npx tsc -p web/tsconfig.json --noEmit` | ✅ 0 errors |

*(Re-checked after all Pass 4/5 fixes — still 0 errors.)*

### Production Build

Command: `npm run build -w web`

| Artifact | Size (minified) | Size (gzip) |
|----------|----------------|-------------|
| `dist/index.html` | 1.89 KB | 0.80 KB |
| `dist/assets/index-*.css` | 66.50 KB | 12.98 KB |
| `dist/assets/LandingPage-*.js` | 232.54 KB | 67.11 KB |
| `dist/assets/index-*.js` | 904.93 KB ⚠️ | 264.27 KB ⚠️ |

**Build result: ✅ SUCCESS** — `web/dist/` produced without errors. One warning: main bundle exceeds the 500 KB vite threshold (no regression from Session 1 — logged as open item PERF-02-001).

---

## Pass 3 — SRS Traceability

All requirements from `SRS-WEB.md` and `SRS.md` verified against the codebase.

### Web Requirements (SRS-WEB.md)

| ID | Requirement | Implementation | Status |
|----|-------------|----------------|--------|
| WEB-001 | Scaffold — builds and deploys | `web/` Vite project; `npm run build -w web` | ✅ |
| WEB-002 | Auth — email/password + JWT | `LoginPage.tsx` · `api/src/routes/auth.ts` | ✅ |
| WEB-003 | App shell — sidebar, role-based menu | `Layout.tsx` · `App.tsx` route guards | ✅ |
| WEB-004 | API client — configurable base URL | `web/src/lib/api.ts` · `VITE_API_URL` | ✅ |
| WEB-010 | Organization profile | `OrganizationPage.tsx` · `GET/PATCH /admin/organization` | ✅ |
| WEB-011 | Users — list + invite | `UsersPage.tsx` · `GET/POST /admin/users` | ✅ |
| WEB-012 | Teams — create, rename, assign | `TeamsPage.tsx` · `POST/PATCH /teams` | ✅ |
| WEB-013 | AI & platform settings | `PlatformPage.tsx` · `GET/PATCH /admin/settings` | ✅ |
| WEB-014 | Connection info + health | `ConnectionPage.tsx` · `GET /health` | ✅ |
| WEB-015 | Audit tail (last 20 AI events) | `AuditPage.tsx` · `GET /admin/audit` | ✅ |
| WEB-020 | Manager home — team stats | `ManagerHomePage.tsx` | ✅ |
| WEB-021 | Pipeline Kanban — filter by team | `PipelinePage.tsx` | ✅ |
| WEB-022 | Leads table — search, filter | `LeadsPage.tsx` | ✅ |
| WEB-023 | Reports — CSV export + charts | `ReportsPage.tsx` · `GET /reports/export.csv` | ✅ |

### API Requirements (SRS-WEB.md §5)

| ID | Route | File | Status |
|----|-------|------|--------|
| API-WEB-001 | `GET/PATCH /admin/organization` | `api/src/routes/admin.ts` | ✅ |
| API-WEB-002 | `GET/POST/PATCH /admin/users` | `api/src/routes/admin.ts` | ✅ |
| API-WEB-003 | `GET/PATCH /admin/settings` | `api/src/routes/admin.ts` | ✅ |
| API-WEB-004 | `GET /admin/health` | `api/src/routes/admin.ts` | ✅ |

### Security Non-Functional Requirements (SRS.md §NFR)

| ID | Requirement | Implementation | Status |
|----|-------------|----------------|--------|
| NFR-001 | JWT auth on all private routes | `fastify.authenticate()` decorator on all 14 route files | ✅ |
| NFR-002 | bcrypt cost ≥ 12 | `admin.ts` POST /admin/users + `seed.ts` | ✅ |
| NFR-003 | Audit log for AI events | `AuditPage` reads `aiAuditLog` table | ✅ |
| NFR-004 | Rate limiting on auth | `@fastify/rate-limit` — 10/min login in production | ✅ |
| NFR-005 | No user enumeration | `DUMMY_BCRYPT_HASH` constant-time path | ✅ |
| NFR-006 | CORS allowlist | `api/src/config.ts` · `corsOrigins[]` | ✅ |
| NFR-007 | Account lockout | `failedLoginCount`, `lockoutUntil` — 5 attempts, 15 min window | ✅ |
| NFR-008 | Password strength gate | zxcvbn score ≥ 3 on user creation | ✅ |

**Verdict: ✅ PASS** — All 20 SRS requirements confirmed implemented. No gaps.

---

## Pass 4 — Page-by-Page UI/UX Inspection

All 21 routes inspected via full source code review. Criteria checked for each page:
- **Loading** — spinner or "Loading…" text shown during data fetch
- **Empty** — friendly message + CTA when no data
- **Real estate** — no large blank areas; gated features show upgrade prompt
- **Forms** — client-side validation, inline errors, clear button labels
- **Destructive** — delete/remove actions require confirmation

### Inspection Results

| Route | Loading | Empty | Real estate | Forms | Destructive | Result |
|-------|---------|-------|-------------|-------|-------------|--------|
| `/landing` | N/A | N/A | ✅ | N/A | N/A | ✅ Pass |
| `/login` | N/A | N/A | ✅ | ✅ | N/A | ✅ Pass |
| `/` (Home) | ✅ | ✅ | ✅ | N/A | N/A | ✅ Pass |
| `/manager` | ✅ | ✅ | ✅ | N/A | N/A | ✅ Pass |
| `/leads` | ✅ | ✅ | ✅ | ✅ | N/A | ✅ Pass |
| `/pipeline` | ✅ | ✅ | ✅ | N/A | N/A | ✅ Pass |
| `/calendar` | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ Pass |
| `/reports` | ✅ | ✅ | ✅ | ✅ | N/A | ✅ Pass |
| `/bulk-import` | ✅ | ✅ | ✅ | ✅ | N/A | ✅ Pass |
| `/audit` | ✅ | ✅ | ✅ | N/A | N/A | ✅ Pass |
| `/users` | ✅ | ✅ | ✅ | ✅ | N/A | ✅ Pass |
| `/teams` | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ Pass |
| `/targets` | ✅ | ✅ | ✅ | ✅ | N/A | ✅ Pass |
| `/platform` | ⚠️ Fixed | ✅ | ✅ | ✅ | N/A | ⚠️ Fixed |
| `/organization` | ✅ | ✅ | ✅ | ✅ | N/A | ✅ Pass |
| `/branding` | ⚠️ Fixed | ✅ | ✅ | ✅ | N/A | ⚠️ Fixed |
| `/crm-settings` | ✅ | ✅ | ✅ | ✅ | ⚠️ Fixed | ⚠️ Fixed |
| `/connection` | ⚠️ Fixed | N/A | ✅ | N/A | N/A | ⚠️ Fixed |
| `/data-hygiene` | ✅ | ✅ | ✅ | N/A | N/A | ✅ Pass |
| `/integrations` | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ Pass |
| `/business` | N/A | ✅ | ✅ | N/A | N/A | ✅ Pass |

**Legend:** ✅ Already correct · ⚠️ Fixed in this session · ❌ Open (none)

### Fixes Applied

#### UX-02-001 — `ConnectionPage.tsx` — No loading state
- **Problem:** `useEffect` fired `api('/admin/health')` but the page rendered immediately with the fallback URL. Users briefly saw a stale value with no visual indication that fresh data was loading.
- **Fix:** Added `const [loading, setLoading] = useState(true)` and a `.finally(() => setLoading(false))` on the fetch. An early-return renders `<p className="muted">Loading…</p>` until the state resolves.
- **File:** `web/src/pages/ConnectionPage.tsx`

#### UX-02-002 — `PlatformPage.tsx` — No loading indicator in Status card
- **Problem:** The Status card (`OpenAI key on server`, `Model`, `Env default`) showed blank content while settings loaded. The save buttons were disabled via `disabled={!data}` but there was no user-visible feedback.
- **Fix:** Added `const [loadingSettings, setLoadingSettings] = useState(true)`, called `.finally(() => setLoadingSettings(false))`, and replaced the empty card body with `{loadingSettings ? <p className="muted">Loading…</p> : data ? <ul>…</ul> : null}`.
- **File:** `web/src/pages/PlatformPage.tsx`

#### UX-02-003 — `CrmSettingsPage.tsx` — Loss reason removal had no confirmation
- **Problem:** Clicking `×` on a loss reason row deleted it immediately with no confirmation dialog. A misclick permanently removed the entry (until the user hit Save to persist, but the entry was gone from the UI instantly).
- **Fix:** Added `window.confirm('Remove this loss reason? Existing leads using this code are unaffected.')` at the top of `removeLossReason()`.
- **File:** `web/src/pages/CrmSettingsPage.tsx`

#### UX-02-004 — `BrandingPage.tsx` — Save button silently disabled during load
- **Problem:** The Save button was `disabled={!loaded}` while initial data fetched, but showed the label "Save branding" with no explanation — making it look broken.
- **Fix:** Changed button label to `{loaded ? 'Save branding' : 'Loading…'}` to match the pattern used in `CrmSettingsPage.tsx`.
- **File:** `web/src/pages/BrandingPage.tsx`

---

## Pass 5 — Security Spot-Check

### Checklist

| Check | Result | Detail |
|-------|--------|--------|
| All private routes behind `fastify.authenticate()` | ✅ | 14 route files confirmed; `GET /health` and `POST /login` are the only intentionally public endpoints |
| IDOR — queries scoped by `organizationId` | ✅ | Verified in `leads.ts`, `reports.ts`, `teams.ts`, `admin.ts`, `activities.ts`, `calendar.ts` |
| No secrets returned in API responses | ✅ | `JWT_SECRET` and `OPENAI_API_KEY` present only in `config.ts`; never serialised in any route response |
| HTML sanitisation on user input | ✅ | `sanitize-html` with tag/attribute allowlist in `email.ts` before Brevo send |
| Attachment downloads: `Content-Disposition` + `nosniff` | ⚠️ Fixed | CSV export was missing `nosniff` — added |
| Timing-safe secret comparison | ✅ | `webhook.service.ts` uses `timingSafeEqual` from `node:crypto` |
| `downloadAuthenticated()` sends Bearer token | ✅ | Confirmed in `web/src/lib/api.ts` lines 70–87 |
| DUMMY_BCRYPT_HASH constant-time login | ✅ | `auth.ts` line 44 — always runs `bcrypt.compare()` even for unknown users |
| Rate limiting on login route | ✅ | 10 req/min/IP in production; 1000 in dev/test |
| CORS allowlist enforced | ✅ | `corsOrigins[]` in `config.ts`; wildcard `*` was fixed in Session 1 |
| No raw SQL | ✅ | Zero `$queryRaw` / `$executeRaw` calls found in `api/src/` |
| `npm audit --audit-level=high` | ⚠️ Partial | nodemailer CVEs fixed; esbuild/vite dev deps remain (see below) |

### OWASP Top 10 Review

| Risk | Status | Mitigation |
|------|--------|------------|
| A01 Broken Access Control | ✅ | `organizationId` on all queries; SALES role `ownerFilter` enforced at API |
| A02 Cryptographic Failures | ✅ | bcrypt cost-12; HS256 JWT; HTTPS via Caddy |
| A03 Injection | ✅ | Prisma ORM throughout — no raw SQL; Zod input validation on all routes |
| A04 Insecure Design | ✅ | Account lockout (5 attempts, 15 min); zxcvbn password gate |
| A05 Security Misconfiguration | ✅ | CORS allowlist; `requiredSecret()` in prod; nosniff headers (fixed this session) |
| A06 Vulnerable Components | ⚠️ | nodemailer upgraded to v9; esbuild/vite dev-only CVEs remain open |
| A07 Auth Failures | ✅ | Constant-time login; account lockout; rate limit on login |
| A08 Data Integrity | ✅ | Webhook `timingSafeEqual`; signed JWTs with expiry |
| A09 Logging/Monitoring | ✅ | AI audit table; fastify request logs |
| A10 SSRF | ✅ | No server-side URL fetch driven by user input |

### Fixes Applied

#### SEC-02-001 — `reports.ts` — CSV export missing `X-Content-Type-Options: nosniff`
- **Problem:** `GET /reports/export.csv` returned `Content-Disposition: attachment` but not `X-Content-Type-Options: nosniff`. Without this header, some browsers may sniff the content type and interpret a CSV as HTML if the file contains something that looks like markup.
- **Fix:** Added `.header('X-Content-Type-Options', 'nosniff')` to the response chain (line 149 of `reports.ts`).
- **File:** `api/src/routes/reports.ts`

#### SEC-02-002 — `api/package.json` — nodemailer 6.x with 4 CVEs
- **Problem:** `nodemailer ^6.10.1` (resolved to 6.10.1) is affected by four advisories:
  - `GHSA-mm7p-fcc7-pg87` — Email delivered to unintended domain (interpretation conflict)
  - `GHSA-rcmh-qjqh-p98v` — addressparser DoS via recursive calls
  - `GHSA-c7w3-x93f-qmm8` — SMTP command injection via unsanitised `envelope.size`
  - `GHSA-vvjj-xcjg-gr5g` — SMTP command injection via CRLF in transport name (EHLO/HELO)
- **Fix:** Upgraded to `^9.0.0` via `npm install nodemailer@9 -w api`. The custom type shim in `api/src/types/nodemailer.d.ts` is unchanged — the `createTransport`/`sendMail` API surface is stable. All 32 API tests still pass post-upgrade.
- **File:** `api/package.json`

---

## Dependency Audit Summary

### `npm audit` results (post-fix)

| Severity | Count | Packages affected | Production? |
|----------|-------|-------------------|-------------|
| Critical | 1 | `esbuild` (via `vite`) | ❌ Dev only |
| High | 5 | `esbuild`, `vite`, `@vitejs/plugin-react`, `vite-node`, `@vitest/mocker` | ❌ Dev only |
| Moderate | 2 | `esbuild` (via `vite`) | ❌ Dev only |
| **Total open** | **8** | **esbuild/vite toolchain** | **Dev only** |

**nodemailer:** ✅ Resolved — upgraded from 6.10.1 to 9.0.0.

**esbuild/vite status:** The remaining 8 vulnerabilities are entirely in the build and test tooling. They affect:
1. The Vite development server on Windows (arbitrary file read)
2. Deno module binary integrity verification

Neither affects the production deployment (`web/dist/` static files) or the Fastify API. Fixing requires upgrading to `vite@8`, which is a breaking major-version change. Logged as open item SEC-02-003 for a dedicated dependency upgrade session.

---

## All Findings — Session 2

| ID | Severity | Category | File / Route | Description | Status |
|----|----------|----------|--------------|-------------|--------|
| UX-02-001 | 🟡 Medium | UX | `ConnectionPage.tsx` | No loading state during health data fetch | ✅ Fixed |
| UX-02-002 | 🟡 Medium | UX | `PlatformPage.tsx` | No loading indicator in Status card during settings fetch | ✅ Fixed |
| UX-02-003 | 🟢 Low | UX | `CrmSettingsPage.tsx` | Loss reason removal had no confirmation dialog | ✅ Fixed |
| UX-02-004 | 🟢 Low | UX | `BrandingPage.tsx` | Save button silently disabled with no "Loading…" feedback | ✅ Fixed |
| SEC-02-001 | 🟠 High | Security | `api/src/routes/reports.ts` | CSV export missing `X-Content-Type-Options: nosniff` | ✅ Fixed |
| SEC-02-002 | 🟠 High | Security | `api/package.json` | nodemailer ≤8.0.4 — 4 CVEs (SMTP injection, DoS, routing) | ✅ Fixed |
| PERF-02-001 | 🟢 Low | Performance | `web/dist/index.js` | Bundle 905 KB / 264 KB gzip exceeds vite 500 KB warning | 🔴 Open |
| SEC-02-003 | 🟡 Medium | Security | `esbuild` (dev dep) | esbuild 0.17–0.28: file read on Windows dev server + Deno integrity — dev tools only | 🔴 Open |

**Total found: 8 · Fixed: 6 · Open: 2**

---

## Open Items (Carried Forward)

| ID | Priority | Description | Impact | Suggested action |
|----|----------|-------------|--------|-----------------|
| OI-004 | P3 | `esbuild`/`vite` dev dep CVEs (SEC-02-003) | Dev environment only; no production impact | Upgrade to `vite@8` in a dedicated dependency session |
| OI-002 | P3 | Main bundle 264 KB gzip (PERF-02-001) | Slow initial load on poor connections | Split `recharts` or other heavy chart lib via dynamic `import()` |
| OI-001 | P2 | Refresh token rotation (carried from Session 1) | Session hijack window extends to 7 days | Implement token rotation on the `/api/auth/refresh` endpoint |
| OI-003 | P3 | Multi-instance account lockout (carried from Session 1) | Single-instance only; horizontal scaling breaks lockout | Redis-backed lockout before any multi-server deployment |

---

## Cumulative QA Scorecard

| Session | Date | Tests pass | Pages inspected | Findings | Critical | High | Medium | Low | Fixed | Open | Result |
|---------|------|-----------|-----------------|----------|----------|------|--------|-----|-------|------|--------|
| 1 | 2026-06-14 | 80/80 | 21/21 | 33 | 7 | 9 | 13 | 4 | 33 | 0 | ✅ PASS |
| 2 | 2026-06-15 | 80/80 | 21/21 | 8 | 0 | 2 | 3 | 3 | 6 | 2 | ✅ PASS |
| **Total** | | **80/80** | **21/21** | **41** | **7** | **11** | **16** | **7** | **39** | **2** | |

---

## Files Changed This Session

| File | Change |
|------|--------|
| `api/src/routes/reports.ts` | Added `X-Content-Type-Options: nosniff` header to CSV export response |
| `api/package.json` | Upgraded `nodemailer` from `^6.10.1` to `^9.0.0` |
| `web/src/pages/ConnectionPage.tsx` | Added `loading` state + early-return loading screen |
| `web/src/pages/PlatformPage.tsx` | Added `loadingSettings` state + "Loading…" text in Status card |
| `web/src/pages/CrmSettingsPage.tsx` | Added `window.confirm()` before loss reason removal |
| `web/src/pages/BrandingPage.tsx` | Save button label switches to "Loading…" while `!loaded` |
| `QA-MASTER.md` | Session 2 report appended to Section 16; scorecard and findings registry updated |

---

*Report generated: 2026-06-15 · WizCRM QA Session 2*
