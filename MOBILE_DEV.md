# WizCRM — Mobile development (Android)

WizCRM mobile is built with **React Native** and **Expo** (`mobile/`). This guide covers the Android toolchain installed on your machine and how to run the app on an **Android emulator**.

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

Start the Android emulator from Android Studio (**Device Manager → Play**), or from CLI:

```powershell
emulator -avd WizCRM_Pixel_7_API_34
```

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

## Useful commands

| Task | Command |
|------|---------|
| List emulators | `emulator -list-avds` |
| Start emulator | `emulator -avd <AVD_NAME>` |
| List devices | `adb devices` |
| Reload app in Expo | `r` in Expo terminal |
| Clear Metro cache | `npx expo start -c` |

## Troubleshooting

- **`adb` not found** — Add `%LOCALAPPDATA%\Android\Sdk\platform-tools` to Path; reopen terminal.
- **No emulators listed** — Create an AVD in Android Studio Device Manager.
- **Emulator won’t start** — Enable virtualization in BIOS (Intel VT-x / AMD-V); in Windows turn off conflicting hypervisors if needed.
- **JAVA_HOME not set** — Point to Microsoft OpenJDK 17 install under `C:\Program Files\Microsoft\`.
- **Expo can’t find Android SDK** — Confirm `ANDROID_HOME` and run Android Studio once to finish SDK install.

## iOS (later)

Requires macOS with Xcode. Not set up on this Windows machine.

## Related

- [README.md](./README.md) — Branches and project overview
