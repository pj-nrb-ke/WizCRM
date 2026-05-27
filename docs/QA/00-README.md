# Consolidated QA Instruction Set

Use these smaller focused instruction files individually to prevent Cursor context drift.

## Run frontend QA (cycle 001+)

Per [01-QA-Core-Rules](./01-QA-Core-Rules.md) and [02-Frontend-Human-QA](./02-Frontend-Human-QA.md):

```powershell
# Production UI + API (Playwright only)
npm run test:qa:frontend

# Full gate: Docker Postgres, unit/integration, then Playwright
powershell -File scripts/run-qa-frontend.ps1

# Local web + API
powershell -File scripts/run-qa-frontend.ps1 -Local -SkipAutomatedGate
```

Reports: `docs/QA/WizCRM-QA-Test-###.xlsx` (required) and `docs/QA/results/QA-Test-###-SUMMARY.md`.

| Step | Command |
|------|---------|
| Frontend (01–02) | `npm run test:qa:frontend` then `npm run qa:report` |
| Backend + enterprise (03–04) | `npm run qa:03-04` (API tests, Excel, chime) |
| Security / performance / mobile (05) | `npm run qa:05` |
| Enterprise destructive (cycle 002) | `npm run qa:002` → `WizCRM-QA-Test-002.xlsx` |
| Enterprise enforcement (cycle 003) | `npm run qa:003` → `WizCRM-QA-Test-003.xlsx` (25+20+20+15+10 tests) |

See [06-QA-Reporting-Excel-Rules](./06-QA-Reporting-Excel-Rules.md). Evidence: `web/e2e-report/`, `docs/QA/results/qa-backend-enterprise.json`.
