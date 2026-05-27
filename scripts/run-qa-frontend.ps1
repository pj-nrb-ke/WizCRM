# Frontend QA cycle (Playwright + report). Per docs/QA/01 and 02.
param(
  [string]$BaseUrl = 'https://app.wizcrm.app',
  [string]$ApiUrl = 'https://api.wizcrm.app',
  [switch]$SkipAutomatedGate,
  [switch]$Local
)

$ErrorActionPreference = 'Stop'
$Root = Split-Path $PSScriptRoot -Parent
Set-Location $Root

if ($Local) {
  $BaseUrl = 'http://127.0.0.1:5173'
  $ApiUrl = 'http://127.0.0.1:3000'
}

$env:QA_BASE_URL = $BaseUrl
$env:QA_API_URL = $ApiUrl

Write-Host "=== WizCRM frontend QA ===" -ForegroundColor Cyan
Write-Host "Web: $BaseUrl"
Write-Host "API: $ApiUrl"

if (-not $SkipAutomatedGate) {
  Write-Host '>> Automated API/unit gate' -ForegroundColor Cyan
  & "$PSScriptRoot\run-qa-automated.ps1"
}

if (-not (Test-Path 'web\node_modules\@playwright\test')) {
  Write-Host '>> npm install (web + playwright)' -ForegroundColor Cyan
  npm install -w web
}

Write-Host '>> Playwright browsers' -ForegroundColor Cyan
Push-Location web
npx playwright install chromium
if ($LASTEXITCODE -ne 0) { Pop-Location; throw 'playwright install failed' }

Write-Host '>> Playwright E2E' -ForegroundColor Cyan
npm run test:e2e
$e2eExit = $LASTEXITCODE
Pop-Location

Write-Host '>> QA report' -ForegroundColor Cyan
node scripts/generate-qa-report.mjs

if ($e2eExit -ne 0) {
  throw "Playwright E2E failed (exit $e2eExit). See web/e2e-report/"
}

Write-Host ''
Write-Host 'Frontend QA cycle complete' -ForegroundColor Green
Write-Host 'Report: docs/QA/WizCRM-QA-Test-###.xlsx + docs/QA/results/QA-Test-###-SUMMARY.md' -ForegroundColor Yellow
