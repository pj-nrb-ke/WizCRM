# WizCRM — Mobile development (Android)

WizCRM mobile is built with **React Native** and **Expo** (`mobile/`). This guide covers the Android toolchain installed on your machine and how to run the app on an **Android emulator**.

## Production APK (pilot / field)

Build a standalone release APK against **https://api.wizcrm.app** (no Metro on the phone):

```powershell
.\scripts\build-apk.ps1 -Production
```

Output: **`WizCRM-production.apk`** at the repo root (~30 MB). Copy to the device and install.

**Phase 1 features in this build** (see [PROGRESS_TRACKER.md](./PROGRESS_TRACKER.md) — mobile delivery table): close Won/Lost with deal value and org loss reasons, log call/email/meeting/note, stage+activity timeline, reopen lead, org source chips on new lead.

After API deploys, rebuild the APK so the JS bundle matches server behavior. Mobile does not import `@wizcrm/shared` at bundle time — mirror types in `mobile/lib/close-lead.ts` when shared enums change.

## Prerequisites installed via winget

| Component | Package | Purpose |
|-----------|---------|---------|
| Node.js | (existing) | JavaScript runtime, npm |
| JDK 17 | `Microsoft.OpenJDK.17` | Android / React Native builds |
| Android Studio | `Google.AndroidStudio` | Android SDK, emulator (AVD), device tools |

## One-time setup after Android Studio installs

1. **Open Android Studio** from the Start menu (first launch runs setup wizard).
2. Choose **Standard** installation so it downloads:
   - Android SDK
   - Android SDK Platform
   - Android Virtual Device (AVD)
3. When the wizard finishes, open **More Actions → Virtual Device Manager** (or **Tools → Device Manager**).
4. Click **Create Device**:
   - Phone: **Pixel 7** (or any recent device)
   - System image: **API 34** or **API 35** with **Google Play** (download if needed)
   - Name the AVD e.g. `WizCRM_Pixel_7_API_34`
5. Click **Finish**, then **Play** on the AVD to confirm the emulator boots.

### Environment variables (Windows)

Set these in **Settings → System → About → Advanced system settings → Environment Variables** (user variables), then restart the terminal:

| Variable | Value (typical) |
|----------|-----------------|
| `ANDROID_HOME` | `%LOCALAPPDATA%\Android\Sdk` |
| Path (append) | `%ANDROID_HOME%\platform-tools` |
| Path (append) | `%ANDROID_HOME%\emulator` |
| Path (append) | `%ANDROID_HOME%\cmdline-tools\latest\bin` |
| `JAVA_HOME` | `C:\Program Files\Microsoft\jdk-17.x.x` (match installed JDK folder) |

Verify in a **new** PowerShell window:

```powershell
adb version
emulator -list-avds
java -version
```

## Run the WizCRM mobile app

From the repo root:

```powershell
cd c:\Users\pj\WizCRM\mobile
npm install
```

Start the Android emulator (recommended — uses **alternate ports** to avoid clashes with other apps):

```powershell
cd c:\Users\pj\WizCRM
.\scripts\reset-android.ps1      # if you see ADB / port 5554 errors
.\scripts\start-emulator.ps1     # ADB 5038, emulator 5556 (not 5037 / 5554)
```

Or from Android Studio (**Device Manager → Play**) — close other emulators first to avoid port conflicts.

Default AVD name is `Medium_Phone`. Override: `$env:WIZCRM_AVD = "Your_Avd_Name"`

Run the app (with Metro bundler):

```powershell
cd c:\Users\pj\WizCRM\mobile
npx expo start
```

Press **`a`** in the Expo terminal to open on the running Android emulator, or:

```powershell
npx expo run:android
```

(first `run:android` build is slower; needs emulator or USB device)

## Port conflicts (ADB / emulator)

| Port | Default | WizCRM scripts |
|------|---------|----------------|
| ADB server | 5037 | **5038** (`ANDROID_ADB_SERVER_PORT`) |
| Emulator | 5554 | **5556** (`emulator -port 5556`) |

If you see `could not connect to TCP port 5554` or `adb protocol fault`:

1. Close extra emulators and Android Studio Device Manager windows.
2. Run `.\scripts\reset-android.ps1`
3. Run `.\scripts\start-emulator.ps1`
4. Run `.\scripts\start-mobile.ps1` and press **`a`**

## APK for a physical phone (no Metro)

The API health URL (`http://YOUR_PC_IP:3000/health`) is **not** the Metro bundler. A plain **debug** APK expects JavaScript from Metro on port **8081** and shows “Unable to load script” without it.

Build a **standalone** APK (JS embedded) **once** (or when app code changes—not when only your Wi‑Fi IP changes):

```powershell
cd c:\Users\pj\WizCRM
.\scripts\build-apk.ps1 -PcIp 192.168.68.58
# or full URL: .\scripts\build-apk.ps1 -ApiUrl "http://192.168.68.58:3000"
# or auto-detect Wi-Fi IP: .\scripts\build-apk.ps1
```

Output: **`WizCRM-lite.apk`** at the repo root. Uninstall any older APK before installing.

### Change API IP without rebuilding the APK

When your laptop and phone are on a new network, put your PC’s API URL in a text file on the phone. The app reads it on startup (login screen shows the active URL and source).

| Location on phone | Path |
|-------------------|------|
| **Recommended** | `Android/data/com.wizag.wizcrm/files/api-url.txt` (no extra permission; `push-api-url.ps1` writes here) |
| Also supported | `Download/WizCRM/api-url.txt` (Files app — app will ask for storage permission) |
| Alternate | `Documents/WizCRM/api-url.txt` |

**File format** (one line; `#` starts a comment):

```text
http://192.168.1.10:3000
```

Shorthand also works: `192.168.1.10:3000` or `192.168.1.10` (port defaults to `3000`).

**From your PC (USB debugging):**

```powershell
.\scripts\push-api-url.ps1
# or: .\scripts\push-api-url.ps1 -PcIp 192.168.1.10
```

**On the phone (Android 13+):** a file in **Documents/WizCRM** cannot be read automatically (storage permission). Either:
- On the login screen: paste `http://YOUR_PC_IP:3000` → **Save API URL**, or tap **Import api-url.txt** and pick your file in Documents/WizCRM, or
- Use the Files app + **Import** as above (recommended if you already created the file there).

Then force-close WizCRM and reopen, or on the login screen tap **Reload API URL from file**.

If no file is found, the app uses the URL baked in at build time (`EXPO_PUBLIC_API_URL`). The login screen lists paths it tried (helps debug wrong folder or permission denied).

**If Reload still shows “build (APK default)”:** rebuild the APK once after pulling the latest code (older builds used a broken file reader). Then run `.\scripts\push-api-url.ps1` with the phone on USB.

**Temporary workaround** (old debug APK): Metro must reach your PC on port **8081**, not just the API on 3000.

```powershell
.\scripts\start-metro-for-phone.ps1
```

From the phone browser, open `http://YOUR_PC_IP:8081/status` — it must say `packager-status:running`. If not, allow Node through Windows Firewall or use USB:

```powershell
adb reverse tcp:8081 tcp:8081
adb reverse tcp:3000 tcp:3000
```

Then force-close the app and open it again.

## Useful commands

| Task | Command |
|------|---------|
| Build phone APK | `.\scripts\build-apk.ps1` |
| Reset ADB + ports | `.\scripts\reset-android.ps1` |
| Start emulator (5556) | `.\scripts\start-emulator.ps1` |
| List emulators | `emulator -list-avds` |
| Start emulator | `emulator -avd <AVD_NAME>` |
| List devices | `adb devices` |
| Reload app in Expo | `r` in Expo terminal |
| Clear Metro cache | `npx expo start -c` |

## Login fails but phone browser `/health` works

The browser can open `http://YOUR_PC_IP:3000/health` while the app shows **Cannot reach the API**. The release APK must allow **HTTP (cleartext)** to your PC on the LAN. `build-apk.ps1` enables this in `AndroidManifest.xml`. Rebuild and reinstall **`WizCRM-lite.apk`**.

When sign-in works, the API terminal shows **`POST /auth/login`** (not only `GET /health`).

## Troubleshooting

- **`adb` not found** - Add `%LOCALAPPDATA%\Android\Sdk\platform-tools` to Path; reopen terminal.
- **No emulators listed** — Create an AVD in Android Studio Device Manager.
- **Emulator won’t start** — Enable virtualization in BIOS (Intel VT-x / AMD-V); in Windows turn off conflicting hypervisors if needed.
- **JAVA_HOME not set** — Point to Microsoft OpenJDK 17 install under `C:\Program Files\Microsoft\`.
- **Expo can’t find Android SDK** — Confirm `ANDROID_HOME` and run Android Studio once to finish SDK install.

## iOS (later)

Requires macOS with Xcode. Not set up on this Windows machine.

## Related

- [README.md](./README.md) — Branches and project overview
