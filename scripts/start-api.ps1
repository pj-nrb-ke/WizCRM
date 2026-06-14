param(
  [switch]$Restart
)

Set-Location "$PSScriptRoot\..\api"

function Test-ApiHealthy {
  try {
    $r = Invoke-RestMethod -Uri "http://127.0.0.1:3000/health" -Method GET -TimeoutSec 3
    return $r
  } catch {
    return $null
  }
}

function Stop-ApiOnPort3000 {
  $on3000 = Get-NetTCPConnection -LocalPort 3000 -State Listen -ErrorAction SilentlyContinue
  if (-not $on3000) { return }
  $pid3000 = $on3000.OwningProcess | Select-Object -First 1
  Write-Host "Stopping API on port 3000 (PID $pid3000)..." -ForegroundColor Yellow
  Stop-Process -Id $pid3000 -Force -ErrorAction SilentlyContinue
  Start-Sleep -Seconds 2
}

$health = Test-ApiHealthy

if ($Restart) {
  Stop-ApiOnPort3000
  $health = $null
} elseif ($health) {
  Write-Host "WizCRM API is already running at http://127.0.0.1:3000" -ForegroundColor Green
  Write-Host "  aiEnabled: $($health.aiEnabled)" -ForegroundColor $(if ($health.aiEnabled) { "Green" } else { "Yellow" })
  if (-not $health.aiEnabled) {
    Write-Host ""
    Write-Host "Added OPENAI_API_KEY to api\.env? Restart to load it:" -ForegroundColor Yellow
    Write-Host "  C:\Users\pj\WizCRM\scripts\start-api.ps1 -Restart" -ForegroundColor Cyan
  } else {
    Write-Host "No need to start again. Use start-mobile.ps1 for the phone app." -ForegroundColor Cyan
  }
  exit 0
}

Write-Host "Building shared package..." -ForegroundColor DarkGray
Set-Location "$PSScriptRoot\.."
npm run build -w shared 2>&1 | Out-Null
if ($LASTEXITCODE -ne 0) {
  Write-Host "shared build failed. Run: npm run build -w shared" -ForegroundColor Red
  exit 1
}
Set-Location "$PSScriptRoot\..\api"

Write-Host "Starting WizCRM API on http://127.0.0.1:3000" -ForegroundColor Cyan
npm run dev
