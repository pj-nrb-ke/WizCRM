# QA Test 001 — Summary

**Date:** 2026-05-27
**Target:** https://app.wizcrm.app (API: https://api.wizcrm.app)
**Excel:** [WizCRM-QA-Test-001.xlsx](../WizCRM-QA-Test-001.xlsx)

## Test Summary

| Metric | Count |
|--------|------:|
| Frontend passed | 7 |
| Frontend failed | 0 |
| Frontend skipped | 0 |
| Frontend total | 7 |
| Backend passed | 17 |
| Backend failed | 0 |
| Enterprise state passed | 5 |
| Security passed | 17 |
| Security failed | 0 |
| Overall | PASS |

## Frontend Tests

| ID | Suite | Test | Status | ms | Notes |
|----|-------|------|--------|---:|-------|
| FE-001 | security-performance.spec.ts › Security — XSS in UI | timeline renders stored markup without executing script | PASS | 8105 |  |
| FE-002 | security-performance.spec.ts › Performance — browser | leads page loads within 15s | PASS | 3770 |  |
| FE-003 | security-performance.spec.ts › Performance — browser | rapid navigation — no error banner (browser lag) | PASS | 4124 |  |
| FE-004 | security-performance.spec.ts › Performance — browser | long session — 20 navigations under 2 minutes | PASS | 4063 |  |
| FE-005 | security-performance.spec.ts › Performance — browser | JS heap growth bounded after repeated navigations | PASS | 4105 |  |
| FE-006 | security-performance.spec.ts › Mobile responsiveness | mobile viewport login and overview | PASS | 3090 |  |
| FE-007 | security-performance.spec.ts › Mobile responsiveness | mobile viewport leads table visible | PASS | 3305 |  |

## Security Tests

See **WizCRM-QA-Test-001.xlsx** → Security Tests sheet (18 rows).

## UX Findings

| ID | Severity | Finding |
|----|----------|---------|
| UX-001 | Low | Home quick-tiles duplicate sidebar link names (Leads, Users) — confuses automation and screen readers. |
| UX-002 | Low | New lead modal does not close on Escape; only Cancel/backdrop. |
| UX-003 | Info | Leads table can show empty rows while Loading… is visible (race for impatient users). |

## Evidence Index

See **WizCRM-QA-Test-001.xlsx** → Evidence Index sheet.
