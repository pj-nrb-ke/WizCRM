# Security/Performance/Mobile QA

Test:
- SQL injection
- XSS
- long-duration usage
- mobile responsiveness
- memory growth
- browser lag

## Run (automated)

```powershell
npm run qa:05
```

Writes `docs/QA/results/qa-security-performance.json` and updates `docs/QA/WizCRM-QA-Test-###.xlsx` (Security Tests sheet). Physical APK pilot remains **MANUAL** (see [MOBILE-PILOT.md](../MOBILE-PILOT.md)).
