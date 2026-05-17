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

Write-Host "Installing mobile packages (if needed)..." -ForegroundColor Cyan
npm install

Write-Host "Starting Expo with a clean cache (Android: press a once)..." -ForegroundColor Cyan
Write-Host "If you see 'Unable to resolve module', wait for bundling to finish or press r to reload." -ForegroundColor DarkGray
npx.cmd expo start --clear
