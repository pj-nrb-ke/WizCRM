# QA cycle 004 — verification after duplicate-race fix + remaining automated gates
param(
  [string]$BaseUrl = 'https://app.wizcrm.app',
  [string]$ApiUrl = 'https://api.wizcrm.app'
)

$ErrorActionPreference = 'Stop'
$Root = Split-Path $PSScriptRoot -Parent
Set-Location $Root

$env:QA_BASE_URL = $BaseUrl
$env:QA_API_URL = $ApiUrl
$env:QA_CYCLE = '004'

Write-Host '=== QA Cycle 004 (verification + remaining gates) ===' -ForegroundColor Cyan

Write-Host '>> Duplicate prevention re-test (25)' -ForegroundColor Cyan
node scripts/qa-cycle-003/run-api-suite.mjs
$dupExit = $LASTEXITCODE

Write-Host '>> Production API smoke' -ForegroundColor Cyan
npm run test:production
$smokeExit = $LASTEXITCODE

Write-Host '>> Security API (doc 05)' -ForegroundColor Cyan
node scripts/run-qa-security-api.mjs
$secExit = $LASTEXITCODE

Write-Host '>> Mobile unit tests' -ForegroundColor Cyan
npm test --prefix mobile
$mobExit = $LASTEXITCODE

Write-Host '>> Playwright enterprise sync sample' -ForegroundColor Cyan
Push-Location web
npx playwright test enterprise-cycle-003.spec.ts --grep "Frontend Sync" --trace retain-on-failure
$pwExit = $LASTEXITCODE
Pop-Location

Write-Host '>> Build cycle 004 report' -ForegroundColor Cyan
node scripts/merge-qa-cycle-004.mjs
node scripts/generate-qa-cycle-004-excel.mjs
node scripts/generate-qa-cycle-004-summary.mjs

Write-Host '>> Chime' -ForegroundColor Cyan
& "$PSScriptRoot\play-qa-chime.ps1"

$fail = @($dupExit, $smokeExit, $secExit, $mobExit, $pwExit) | Where-Object { $_ -ne 0 }
if ($fail.Count -gt 0) {
  Write-Host "Cycle 004 finished with failures. Excel: docs/QA/WizCRM-QA-Test-004.xlsx" -ForegroundColor Yellow
  exit 1
}
Write-Host 'Cycle 004 complete — automated QA gate passed.' -ForegroundColor Green
Write-Host 'Manual only: MOBILE-PILOT.md (physical Android device)' -ForegroundColor Yellow
