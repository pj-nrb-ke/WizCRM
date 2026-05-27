# Enterprise QA cycle 002 per docs/QA/WizCRM-QA-Agent-Feedback-and-Instructions.md
param(
  [string]$BaseUrl = 'https://app.wizcrm.app',
  [string]$ApiUrl = 'https://api.wizcrm.app'
)

$ErrorActionPreference = 'Stop'
$Root = Split-Path $PSScriptRoot -Parent
Set-Location $Root

$env:QA_BASE_URL = $BaseUrl
$env:QA_API_URL = $ApiUrl
$env:QA_CYCLE = '002'

$batchStart = Get-Date
$batchLimitMin = 15

Write-Host '=== WizCRM QA Cycle 002 (Enterprise) ===' -ForegroundColor Cyan
Write-Host "Target: $BaseUrl | $ApiUrl" -ForegroundColor Cyan

function Test-BatchTimeout {
  $elapsed = ((Get-Date) - $batchStart).TotalMinutes
  if ($elapsed -gt $batchLimitMin) {
    throw "Batch timeout ${batchLimitMin}m exceeded"
  }
}

Write-Host '>> Playwright enterprise cycle 002' -ForegroundColor Cyan
Push-Location web
npx playwright test enterprise-cycle-002.spec.ts --trace retain-on-failure
$pwExit = $LASTEXITCODE
Pop-Location
Test-BatchTimeout

Write-Host '>> Merge results JSON' -ForegroundColor Cyan
node scripts/merge-qa-cycle-002.mjs
$mergeExit = $LASTEXITCODE

Write-Host '>> Excel WizCRM-QA-Test-002.xlsx' -ForegroundColor Cyan
node scripts/generate-qa-cycle-002-excel.mjs
if ($LASTEXITCODE -ne 0) { throw 'Excel generation failed' }

Write-Host '>> Summary markdown' -ForegroundColor Cyan
node scripts/generate-qa-cycle-002-summary.mjs

Write-Host '>> Chime' -ForegroundColor Cyan
& "$PSScriptRoot\play-qa-chime.ps1"

if ($pwExit -ne 0 -or $mergeExit -ne 0) {
  Write-Host "`nCycle 002 finished with failures (pw=$pwExit merge=$mergeExit). Excel written." -ForegroundColor Yellow
  exit 1
}

Write-Host "`nCycle 002 complete: docs/QA/WizCRM-QA-Test-002.xlsx" -ForegroundColor Green
