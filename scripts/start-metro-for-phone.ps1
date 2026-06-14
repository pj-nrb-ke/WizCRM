# Run Metro so a physical phone (WizCRM-lite-debug.apk) can load JavaScript.
# Usage: .\scripts\start-metro-for-phone.ps1
# Optional: .\scripts\start-metro-for-phone.ps1 -ApiUrl "http://192.168.68.53:3000"

param([string]$ApiUrl = "")

$ErrorActionPreference = "Stop"
$Root = Split-Path -Parent $PSScriptRoot
$Mobile = Join-Path $Root "mobile"

function Get-LanIp {
  $addrs = Get-NetIPAddress -AddressFamily IPv4 -ErrorAction SilentlyContinue |
    Where-Object {
      $_.IPAddress -notlike '127.*' -and
      $_.IPAddress -notlike '169.254*' -and
      $_.PrefixOrigin -ne 'WellKnown'
    }
  foreach ($a in $addrs) {
    $adapter = Get-NetAdapter -InterfaceIndex $a.InterfaceIndex -ErrorAction SilentlyContinue
    if (-not $adapter) { continue }
    if ($adapter.Name -match 'vEthernet|Virtual|VPN|WSL|Hyper-V|Docker') { continue }
    if ($adapter.Name -match 'Wi-?Fi|WLAN|Ethernet') { return $a.IPAddress }
  }
  $home = $addrs | Where-Object { $_.IPAddress -match '^(192\.168|10\.)\d+\.\d+$' } |
    Select-Object -First 1 -ExpandProperty IPAddress
  if ($home) { return $home }
  return ($addrs | Select-Object -First 1 -ExpandProperty IPAddress)
}

$lan = Get-LanIp
if (-not $lan) { throw "Could not detect LAN IP. Pass -ApiUrl http://YOUR_PC_IP:3000" }

if (-not $ApiUrl) { $ApiUrl = "http://${lan}:3000" }

$env:REACT_NATIVE_PACKAGER_HOSTNAME = $lan
$env:EXPO_PUBLIC_API_URL = $ApiUrl

Write-Host ""
Write-Host "Phone + Metro setup" -ForegroundColor Cyan
Write-Host "  PC LAN IP:     $lan" -ForegroundColor Green
Write-Host "  Metro (JS):    http://${lan}:8081" -ForegroundColor Green
Write-Host "  API (login):   $ApiUrl" -ForegroundColor Green
Write-Host ""
Write-Host "1. Allow Node through Windows Firewall for Private networks (ports 8081 and 3000)." -ForegroundColor Yellow
Write-Host "2. Phone and PC on the same Wi-Fi (not guest / isolated Wi-Fi)." -ForegroundColor Yellow
Write-Host ""
Write-Host "Test from phone browser:" -ForegroundColor Cyan
Write-Host "  $ApiUrl/health" -ForegroundColor White
Write-Host "  http://${lan}:8081/status   (should show packager-status:running)" -ForegroundColor White
Write-Host ""
Write-Host "USB option (often easiest with debug APK):" -ForegroundColor Cyan
Write-Host "  adb reverse tcp:8081 tcp:8081" -ForegroundColor White
Write-Host "  adb reverse tcp:3000 tcp:3000" -ForegroundColor White
Write-Host ""
Write-Host "On phone: force-close WizCRM, reopen after Metro says Ready." -ForegroundColor Yellow
Write-Host "If still red screen: shake phone -> Dev menu -> change bundle location to ${lan}:8081 -> Reload" -ForegroundColor Yellow
Write-Host ""

Set-Location $Mobile
npx expo start --lan --clear
