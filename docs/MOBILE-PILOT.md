# WizCRM mobile — production pilot

**Goal:** Confirm **Lite+ Pro** mobile works against **https://api.wizcrm.app** on a real Android phone.

## Install

1. Install **`WizCRM-production.apk`** from the repo root (built with `.\scripts\build-apk.ps1 -Production`).
2. Open app → sign in:
   - **Rep:** `rep@wizag.local` / `wizcrm123`
   - **Manager:** `manager@wizag.local` / `wizcrm123`
3. **Settings** (header) → API should show `https://api.wizcrm.app` (no `:3000`).

## 5-minute pilot script (rep)

| Step | Action | Pass? |
|------|--------|-------|
| 1 | **Desk** loads with items (or empty + no error) | ☐ |
| 2 | **Leads** → **+ New lead** → save with name + phone or email | ☐ |
| 3 | **Call** from lead → return to app → **Log this call?** prompt → post-call | ☐ |
| 4 | **Edit** lead → set source + priority (HOT/WARM/COLD) | ☐ |
| 5 | **WhatsApp** opens when phone present; **Pro scores** + hygiene on lead | ☐ |
| 6 | **Message draft** (WhatsApp or email) — approve before sending externally | ☐ |
| 7 | Add a **note** (try airplane mode → note queues, syncs when online) | ☐ |
| 8 | **Pipeline** shows lead in correct stage | ☐ |

## Manager (optional)

| Step | Action | Pass? |
|------|--------|-------|
| 1 | **Team** tab → see teams / stats | ☐ |
| 2 | **Leads** / **Pipeline** with team filter | ☐ |
| 3 | Open lead → read-only (no edit) | ☐ |

## If something fails

- **Cannot reach API** → Settings → API URL = `https://api.wizcrm.app` → Save.
- **AI errors on desk** → Server needs OpenAI key; desk still works via Leads tab.
- Report what step failed; engineering fixes before expanding scope.

## After pilot passes

- Mark **QA-LITE-PILOT** and related rows in [PROGRESS_TRACKER.md](../PROGRESS_TRACKER.md).
- Distribute same APK to the team or upload to Play internal testing.
