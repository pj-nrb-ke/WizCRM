# QA cycles 03 (Backend/API/DB) + 04 (Enterprise state), then Excel + chime
param(
  [string]$ApiUrl = 'https://api.wizcrm.app',
  [string]$Cycle = '001'
)

$ErrorActionPreference = 'Stop'
$Root = Split-Path $PSScriptRoot -Parent
Set-Location $Root

$env:QA_API_URL = $ApiUrl
$env:QA_CYCLE = $Cycle

Write-Host '=== QA 03 + 04 ===' -ForegroundColor Cyan

Write-Host '>> Backend + Enterprise API tests' -ForegroundColor Cyan
node scripts/run-qa-backend-enterprise.mjs
if ($LASTEXITCODE -ne 0) {
  Write-Host 'Some backend/enterprise checks failed (see JSON). Updating Excel anyway.' -ForegroundColor Yellow
}

Write-Host '>> Excel + markdown report' -ForegroundColor Cyan
npm run qa:report
if ($LASTEXITCODE -ne 0) { throw 'qa:report failed' }

Write-Host '>> Chime' -ForegroundColor Cyan
& "$PSScriptRoot\play-qa-chime.ps1"

Write-Host "`nQA 03+04 complete. Excel: docs/QA/WizCRM-QA-Test-$Cycle.xlsx" -ForegroundColor Green
