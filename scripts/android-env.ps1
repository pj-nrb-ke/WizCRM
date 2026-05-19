# WizCRM — dedicated Android ports (avoids clashes with other tools on 5037 / 5554)
# Dot-source from other scripts:  . "$PSScriptRoot\android-env.ps1"

$script:WizCRM_AdbPort = 5038
$script:WizCRM_EmulatorPort = 5556
$script:WizCRM_AvdName = if ($env:WIZCRM_AVD) { $env:WIZCRM_AVD } else { "Medium_Phone" }

$sdk = $env:ANDROID_HOME
if (-not $sdk) {
  $sdk = Join-Path $env:LOCALAPPDATA "Android\Sdk"
}
$script:WizCRM_AndroidSdk = $sdk
$script:WizCRM_Adb = Join-Path $sdk "platform-tools\adb.exe"
$script:WizCRM_Emulator = Join-Path $sdk "emulator\emulator.exe"

$env:ANDROID_ADB_SERVER_PORT = "$script:WizCRM_AdbPort"

function Test-WizCrmPortListening([int]$Port) {
  $conn = Get-NetTCPConnection -LocalPort $Port -State Listen -ErrorAction SilentlyContinue
  return [bool]$conn
}

function Wait-WizCrmEmulatorReady {
  param(
    [int]$TimeoutSec = 180,
    [string]$Serial = "emulator-$($script:WizCRM_EmulatorPort)"
  )
  $deadline = (Get-Date).AddSeconds($TimeoutSec)
  while ((Get-Date) -lt $deadline) {
    $out = & $script:WizCRM_Adb devices 2>&1 | Out-String
    if ($out -match "${Serial}\s+device") {
      $boot = & $script:WizCRM_Adb -s $Serial shell getprop sys.boot_completed 2>&1
      if ($boot -match "1") { return $true }
    }
    Start-Sleep -Seconds 3
  }
  return $false
}
