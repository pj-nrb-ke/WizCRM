# Automated QA sign-off (engineering)

**Date:** 2026-05-22  
**Gate:** Run before user/device testing.

## How to run

```powershell
.\scripts\run-qa-automated.ps1
```

If `npm config get omit` is `dev`, run once: `npm install --include=dev` (the script does this when `@types/react` is missing).

Or CI: GitHub Actions workflow `Test` (unit + integration jobs).

## P5 — Web (WEB-012) ✅ automated

| Check | Evidence |
|-------|----------|
| Teams list on web | `TeamsPage.tsx` + `GET /admin/teams` |
| Create / edit / delete team | `POST/PATCH/DELETE /teams` |
| Assign members | `PUT /teams/:id/members` |
| Integration tests | `api/tests/teams-integration.test.ts` |
| Web build | CI `npm run build -w web` |

## P6 — Infrastructure ✅ automated

| ID | Status | Evidence |
|----|--------|----------|
| INF-004 | ✅ | Integration tests cover auth, leads, activities, tasks, teams |
| INF-005 | ✅ | `UT-INF-005`, AI routes 503/200 without key |
| INF-006 | ✅ | Web build in CI; live at app.wizcrm.app |
| INF-007 | ✅ | `.github/workflows/test.yml` |
| INF-009 | ✅ | `npm test` shared + api + mobile |
| INF-010 | ✅ | CI runs all UT on push/PR |
| QA-INF-004 | ✅ | Integration job = API smoke (db push, seed, inject) |
| Email | ✅ | `email:validate`, `GET /email/status` |

## P1/P2 — Lite QA (API-automated)

| ID | Automated | Notes |
|----|-----------|-------|
| QA-LITE-001 | ✅ | `qa-lite-automated.test.ts` |
| QA-LITE-002 | ✅ | Duplicate 409 |
| QA-LITE-003 | ✅ | `UT-LITE-003` card mapper |
| QA-LITE-004 | ✅ | Stage rules + PATCH |
| QA-LITE-005 | ✅ | Desk items |
| QA-LITE-006 | ✅ | Summary 200 or 503 |
| QA-LITE-007 | ✅ | Next-action dismiss |
| QA-LITE-008 | ✅ | Note on timeline |
| QA-LITE-009 | ✅ | Post-call confirm |
| QA-LITE-010 | ✅ | Timeline order |
| QA-LITE-011 | ✅ | Task create/complete + desk endpoint (ranking: UT-LITE-005) |
| QA-LITE-012 | ✅ | Pipeline bucket |
| QA-LITE-013 | ✅ | No signup; 401 bad login |
| UT-LITE-001–014 | ✅ | Unit + integration |
| E2E-LITE-LOGIN/LEAD/DESK/TIMELINE | ✅ | `lite-integration.test.ts` |

## User testing only (after this gate)

| ID | Why manual |
|----|------------|
| QA-LITE-ANDROID | Install APK, gestures, crashes |
| QA-LITE-PILOT | Full device pilot script |
| QA-LITE-003 | Camera / card photo on device |
| QA-LITE-004/007/008 | AI UI confirm, voice on device |
| QA-NFR-004 | Airplane mode on phone |

When automated gate passes, proceed to [MOBILE-PILOT.md](./MOBILE-PILOT.md).
