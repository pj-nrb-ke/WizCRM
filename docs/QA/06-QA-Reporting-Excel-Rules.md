# QA Reporting Rules

Excel naming:
WizCRM-QA-Test-###.xlsx

Start from 001 and increment every cycle.

Required sheets:
- Test Summary
- Frontend Tests
- Backend Tests
- Security Tests
- UX Findings
- Evidence Index

## Generate after a test run

```powershell
# Uses web/e2e-report/results.json; auto-increments ### if WizCRM-QA-Test-###.xlsx exists
npm run qa:report

# Pin cycle number (e.g. re-export 001)
$env:QA_CYCLE = '001'; npm run qa:report
```

Output: `docs/QA/WizCRM-QA-Test-###.xlsx` plus `docs/QA/results/QA-Test-###-SUMMARY.md`.
