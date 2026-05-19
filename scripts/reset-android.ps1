# Stop leftover ADB / emulator processes and restart ADB on WizCRM port 5038.
# Run before start-emulator.ps1 if you see "protocol fault" or port 5554 errors.

. "$PSScriptRoot\android-env.ps1"

Write-Host "WizCRM Android reset" -ForegroundColor Cyan
Write-Host "  ADB server port: $WizCRM_AdbPort (default is 5037)" -ForegroundColor DarkGray
Write-Host "  Emulator port:   $WizCRM_EmulatorPort (default is 5554)" -ForegroundColor DarkGray

# Stop emulators on common ports (default 5554 and WizCRM 5556)
$defaultAdb = Join-Path $WizCRM_AndroidSdk "platform-tools\adb.exe"
foreach ($port in @(5554, 5556, 5558)) {
  $serial = "emulator-$port"
  & $defaultAdb -s $serial emu kill 2>$null
}

Get-Process -Name "adb" -ErrorAction SilentlyContinue | ForEach-Object {
  Write-Host "Stopping adb (PID $($_.Id))..." -ForegroundColor Yellow
  Stop-Process -Id $_.Id -Force -ErrorAction SilentlyContinue
}

Get-Process -Name "emulator", "qemu-system-x86_64", "qemu-system-aarch64" -ErrorAction SilentlyContinue |
  ForEach-Object {
    Write-Host "Stopping $($_.ProcessName) (PID $($_.Id))..." -ForegroundColor Yellow
    Stop-Process -Id $_.Id -Force -ErrorAction SilentlyContinue
  }

Start-Sleep -Seconds 2

if (-not (Test-Path $WizCRM_Adb)) {
  Write-Host "adb not found at $WizCRM_Adb - set ANDROID_HOME." -ForegroundColor Red
  exit 1
}

$env:ANDROID_ADB_SERVER_PORT = "$WizCRM_AdbPort"
& $WizCRM_Adb kill-server 2>$null
Start-Sleep -Seconds 1
& $WizCRM_Adb start-server
if ($LASTEXITCODE -ne 0) {
  Write-Host "Failed to start ADB on port $WizCRM_AdbPort" -ForegroundColor Red
  exit 1
}

Write-Host "ADB ready on port $WizCRM_AdbPort" -ForegroundColor Green
& $WizCRM_Adb devices -l
