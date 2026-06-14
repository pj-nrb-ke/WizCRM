# Enterprise QA enforcement cycle 003
param(
  [string]$BaseUrl = 'https://app.wizcrm.app',
  [string]$ApiUrl = 'https://api.wizcrm.app'
)

$ErrorActionPreference = 'Stop'
$Root = Split-Path $PSScriptRoot -Parent
Set-Location $Root

$env:QA_BASE_URL = $BaseUrl
$env:QA_API_URL = $ApiUrl
$env:QA_CYCLE = '003'

Write-Host '=== QA Cycle 003 (Enterprise Enforcement) ===' -ForegroundColor Cyan

Write-Host '>> API: duplicate (25+) race (20+) session (20+)' -ForegroundColor Cyan
node scripts/qa-cycle-003/run-api-suite.mjs
$apiExit = $LASTEXITCODE

Write-Host '>> Playwright: multi-tab (15) long-duration (10x50 nav) frontend sync (8)' -ForegroundColor Cyan
Push-Location web
npx playwright test enterprise-cycle-003.spec.ts --trace retain-on-failure
$pwExit = $LASTEXITCODE
Pop-Location

Write-Host '>> Merge + Excel 003' -ForegroundColor Cyan
node scripts/merge-qa-cycle-003.mjs
$mergeExit = $LASTEXITCODE
node scripts/generate-qa-cycle-003-excel.mjs
node scripts/generate-qa-cycle-003-summary.mjs

Write-Host '>> Chime' -ForegroundColor Cyan
& "$PSScriptRoot\play-qa-chime.ps1"

if ($apiExit -ne 0 -or $pwExit -ne 0) {
  Write-Host "Done with failures api=$apiExit pw=$pwExit. Excel: docs/QA/WizCRM-QA-Test-003.xlsx" -ForegroundColor Yellow
  exit 1
}

Write-Host 'Cycle 003 complete: docs/QA/WizCRM-QA-Test-003.xlsx' -ForegroundColor Green
