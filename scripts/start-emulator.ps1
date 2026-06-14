# Start Android emulator on WizCRM port 5556 with ADB on 5038 (avoids 5554/5037 conflicts).
# Usage: .\scripts\start-emulator.ps1
# Optional: $env:WIZCRM_AVD = "Your_Avd_Name"

. "$PSScriptRoot\android-env.ps1"

& "$PSScriptRoot\reset-android.ps1"
if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }

if (-not (Test-Path $WizCRM_Emulator)) {
  Write-Host "emulator not found at $WizCRM_Emulator" -ForegroundColor Red
  Write-Host "Install Android Studio SDK or set ANDROID_HOME." -ForegroundColor Yellow
  exit 1
}

$avds = & $WizCRM_Emulator -list-avds 2>&1
if ($avds -notcontains $WizCRM_AvdName) {
  Write-Host "AVD '$WizCRM_AvdName' not found. Available:" -ForegroundColor Yellow
  $avds | ForEach-Object { Write-Host "  $_" }
  exit 1
}

if (Test-WizCrmPortListening $WizCRM_EmulatorPort) {
  Write-Host "Port $WizCRM_EmulatorPort already in use - emulator may already be running." -ForegroundColor Yellow
  & $WizCRM_Adb devices -l
  exit 0
}

$serial = "emulator-$WizCRM_EmulatorPort"
Write-Host "Starting $WizCRM_AvdName on $serial (ADB port $WizCRM_AdbPort)..." -ForegroundColor Cyan
Write-Host "Leave this window open. Wait for the Android home screen." -ForegroundColor DarkGray

# -no-snapshot-load avoids corrupt snapshot boot issues; first boot is slower.
Start-Process -FilePath $WizCRM_Emulator -ArgumentList @(
  "-avd", $WizCRM_AvdName,
  "-port", "$WizCRM_EmulatorPort",
  "-no-snapshot-load"
) -WindowStyle Normal

Write-Host "Waiting for $serial to boot..." -ForegroundColor Cyan
if (Wait-WizCrmEmulatorReady) {
  Write-Host "$serial is ready." -ForegroundColor Green
  & $WizCRM_Adb devices -l
  Write-Host ""
  Write-Host "Next: in WizCRM Mobile terminal run  npx expo start  then press  a" -ForegroundColor Green
} else {
  Write-Host "Timed out waiting for emulator. Check the Emulator window for errors." -ForegroundColor Red
  exit 1
}
