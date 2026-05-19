$Root = Split-Path -Parent $PSScriptRoot
Set-Location "$Root\mobile"
$env:EXPO_PUBLIC_API_URL = "http://10.0.2.2:3000"

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

# Expo Go does not use mobile/android; Gradle caches there break Metro's file watcher.
$androidDir = Join-Path (Get-Location) "android"
$androidStash = Join-Path (Get-Location) ".android-apk-stash"
if (Test-Path $androidDir) {
  try {
    if (Test-Path $androidStash) { Remove-Item $androidStash -Recurse -Force }
    Rename-Item $androidDir ".android-apk-stash" -ErrorAction Stop
    Write-Host "Moved android/ -> .android-apk-stash (Expo Go only; APK builds restore via build-apk.ps1)" -ForegroundColor DarkGray
  } catch {
    Write-Host "Could not move android/ (Gradle may be running). Metro will ignore it via metro.config.js." -ForegroundColor Yellow
  }
}

try {
  $null = Invoke-RestMethod -Uri "http://127.0.0.1:3000/health" -Method GET -TimeoutSec 2
  Write-Host "API is up at http://127.0.0.1:3000 (emulator uses http://10.0.2.2:3000)" -ForegroundColor Green
} catch {
  Write-Host "API is not reachable on port 3000. In another terminal run: scripts\start-api.ps1" -ForegroundColor Yellow
}

Write-Host "Starting Expo (Android emulator: press a after Metro is ready)" -ForegroundColor Cyan
Write-Host "Terminal logs here are normal. Ignore unless you see a red ERROR." -ForegroundColor DarkGray
Write-Host "If the emulator shows 'No apps connected', press a (not r) once Metro is running." -ForegroundColor DarkGray
npx.cmd expo start --clear
