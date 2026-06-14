# Mobile Lite — P1/P2 sign-off

**P1 (build):** feature-complete on `development`; install `WizCRM-production.apk`.  
**P2 (sign-off):** split into **automated** (agent/CI) and **device** (you).

## Automated (agent runs)

```powershell
.\scripts\test-lite.ps1
# With local Postgres (docker compose -f docker/docker-compose.yml up -d):
.\scripts\test-lite.ps1 -Integration
```

Covers: `UT-LITE-001`–`014` (schemas, desk rules, card mapper, mobile route constants, call-return logic), plus API integration journeys when `-Integration` / CI.

## Device QA (you — blocks QA-LITE-PILOT)

Use [MOBILE-PILOT.md](./MOBILE-PILOT.md). Check each box, then reply **“pilot pass”** or list failed steps.

| ID | What you verify on phone |
|----|---------------------------|
| QA-LITE-ANDROID | Install APK, login, one lead, one note, no crash |
| QA-LITE-001–014 | Pilot script steps (call return, edit, offline note, drafts, etc.) |
| QA-LITE-PILOT | Full 5‑minute rep script |

## Definition of done

- All `UT-*` and `E2E-*` green in CI  
- You confirm **QA-LITE-PILOT** on a physical Android device  
- Then P1 + P2 close in [PHASE-STATUS.md](../PHASE-STATUS.md)
