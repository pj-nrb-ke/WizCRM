Set-Location "$PSScriptRoot\..\mobile"
$env:EXPO_PUBLIC_API_URL = "http://10.0.2.2:3000"

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

Write-Host "Starting Expo (Android emulator: press a)" -ForegroundColor Cyan
Write-Host "Terminal logs here are normal. Ignore unless you see a red ERROR." -ForegroundColor DarkGray
npx.cmd expo start --clear
