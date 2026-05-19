$Root = Split-Path -Parent $PSScriptRoot
. "$PSScriptRoot\android-env.ps1"
Set-Location "$Root\mobile"
$env:EXPO_PUBLIC_API_URL = "http://10.0.2.2:3000"

# Use WizCRM ADB port so Expo does not fight Android Studio on 5037
$env:ANDROID_ADB_SERVER_PORT = "$WizCRM_AdbPort"

# A hoisted metro at repo root breaks Expo CLI (TerminalReporter export error).
$rogueMetro = Join-Path $Root "node_modules\metro"
if (Test-Path $rogueMetro) {
  Write-Host "Removing incompatible metro from repo root (breaks npx expo start)..." -ForegroundColor Yellow
  Remove-Item $rogueMetro -Recurse -Force -ErrorAction SilentlyContinue
}

function Clear-MetroNativeArtifacts {
  $nm = Join-Path (Get-Location) "node_modules"
  if (-not (Test-Path $nm)) { return }

  Write-Host "Clearing native build caches in node_modules (fixes Metro ENOENT)..." -ForegroundColor DarkGray
  Get-ChildItem $nm -Directory -ErrorAction SilentlyContinue | ForEach-Object {
    foreach ($platform in @("android", "ios")) {
      $build = Join-Path $_.FullName "$platform\build"
      if (Test-Path $build) {
        Remove-Item $build -Recurse -Force -ErrorAction SilentlyContinue
      }
    }
  }
}

# Free port 8081 if a leftover Metro/Expo process is still running
$on8081 = Get-NetTCPConnection -LocalPort 8081 -State Listen -ErrorAction SilentlyContinue
if ($on8081) {
  $pid8081 = $on8081.OwningProcess | Select-Object -First 1
  $proc = Get-Process -Id $pid8081 -ErrorAction SilentlyContinue
  if ($proc -and $proc.ProcessName -match 'node') {
    Write-Host "Stopping previous Expo/Metro on port 8081 (PID $pid8081)..." -ForegroundColor Yellow
    Stop-Process -Id $pid8081 -Force -ErrorAction SilentlyContinue
    Start-Sleep -Seconds 2
  }
}

Clear-MetroNativeArtifacts

# Expo Go does not use mobile/android; Gradle caches there break Metro file watcher.
$androidDir = Join-Path (Get-Location) "android"
$androidStash = Join-Path (Get-Location) ".android-apk-stash"
if (Test-Path $androidDir) {
  try {
    if (Test-Path $androidStash) { Remove-Item $androidStash -Recurse -Force }
    Rename-Item $androidDir ".android-apk-stash" -ErrorAction Stop
    Write-Host "Moved android/ to .android-apk-stash (Expo Go only)" -ForegroundColor DarkGray
  } catch {
    Write-Host "Could not move android/. Metro will ignore it via metro.config.js." -ForegroundColor Yellow
  }
}

try {
  $null = Invoke-RestMethod -Uri "http://127.0.0.1:3000/health" -Method GET -TimeoutSec 2
  Write-Host "API is up at http://127.0.0.1:3000 (emulator uses http://10.0.2.2:3000)" -ForegroundColor Green
} catch {
  Write-Host ""
  Write-Host "API is NOT running - login will fail with Network request failed." -ForegroundColor Red
  Write-Host "Start this FIRST in another terminal: .\scripts\start-api.ps1" -ForegroundColor Yellow
  Write-Host ""
}

$serial = "emulator-$WizCRM_EmulatorPort"
$adbDevices = & $WizCRM_Adb devices 2>&1 | Out-String
if ($adbDevices -notmatch "${serial}\s+device") {
  Write-Host "No emulator on $serial yet. In another terminal run:" -ForegroundColor Yellow
  Write-Host "  .\scripts\start-emulator.ps1" -ForegroundColor Yellow
} else {
  Write-Host "Emulator $serial is connected (ADB port $WizCRM_AdbPort)." -ForegroundColor Green
}

Write-Host "Starting Expo - press a after Metro is ready" -ForegroundColor Cyan
Write-Host "Ports: Metro 8081, ADB $WizCRM_AdbPort, Emulator $WizCRM_EmulatorPort" -ForegroundColor DarkGray
Write-Host "If Android fails: .\scripts\reset-android.ps1 then .\scripts\start-emulator.ps1" -ForegroundColor DarkGray
npx.cmd expo start --clear
