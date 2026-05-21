# Writes your PC's API URL to the phone (no APK rebuild when Wi-Fi IP changes).
#
# Usage:
#   .\scripts\push-api-url.ps1
#   .\scripts\push-api-url.ps1 -PcIp 192.168.1.10
#   .\scripts\push-api-url.ps1 -ApiUrl "http://192.168.1.10:3000"
#
# Pushes to (phone):
#   Android/data/com.wizag.wizcrm/files/api-url.txt  (recommended — no extra permission)
#   Download/WizCRM/api-url.txt                      (optional — Files app)

param(
  [string]$ApiUrl = "",
  [string]$PcIp = "",
  [int]$Port = 3000,
  [string]$Package = "com.wizag.wizcrm"
)

$ErrorActionPreference = "Stop"

function Get-WifiIPv4 {
  Get-NetIPAddress -AddressFamily IPv4 -ErrorAction SilentlyContinue |
    Where-Object {
      $_.IPAddress -notmatch '^127\.' -and
      $_.PrefixOrigin -eq 'Dhcp' -and
      $_.InterfaceAlias -match 'Wi-?Fi|Wireless'
    } |
    Select-Object -First 1 -ExpandProperty IPAddress
}

if ($ApiUrl) {
  $url = $ApiUrl.Trim()
} elseif ($PcIp) {
  $url = "http://${PcIp}:${Port}"
} else {
  $ip = Get-WifiIPv4
  if (-not $ip) { throw "Could not detect Wi-Fi IP. Use -PcIp or -ApiUrl." }
  $url = "http://${ip}:${Port}"
}

if ($url -notmatch '^https?://') { $url = "http://$url" }

$adb = Get-Command adb -ErrorAction SilentlyContinue
if (-not $adb) {
  $sdk = Join-Path $env:LOCALAPPDATA "Android\Sdk\platform-tools\adb.exe"
  if (-not (Test-Path $sdk)) { throw "adb not found. Add Android platform-tools to PATH." }
  $adb = $sdk
} else {
  $adb = $adb.Source
}

$devices = & $adb devices 2>&1 | Select-String "device$"
if (-not $devices) { throw "No Android device connected (USB debugging on?)." }

$temp = Join-Path $env:TEMP "wizcrm-api-url.txt"
Set-Content -Path $temp -Value $url -NoNewline -Encoding utf8

$appFilesDir = "/sdcard/Android/data/$Package/files"
$downloadDir = "/sdcard/Download/WizCRM"

& $adb shell "mkdir -p `"$appFilesDir`" `"$downloadDir`"" | Out-Null
& $adb push $temp "$appFilesDir/api-url.txt"
& $adb push $temp "$downloadDir/api-url.txt"
Remove-Item $temp -Force

Write-Host "Pushed API URL to phone:" -ForegroundColor Green
Write-Host "  $url" -ForegroundColor Cyan
Write-Host "  $appFilesDir/api-url.txt  (primary)" -ForegroundColor DarkGray
Write-Host "  $downloadDir/api-url.txt" -ForegroundColor DarkGray
Write-Host "Force-close WizCRM, reopen, tap Reload API URL on login." -ForegroundColor Yellow
