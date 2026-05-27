# QA doc 05 — Security / Performance / Mobile
param(
  [string]$ApiUrl = 'https://api.wizcrm.app',
  [string]$BaseUrl = 'https://app.wizcrm.app',
  [string]$Cycle = '001'
)

$ErrorActionPreference = 'Stop'
$Root = Split-Path $PSScriptRoot -Parent
Set-Location $Root

$env:QA_API_URL = $ApiUrl
$env:QA_BASE_URL = $BaseUrl
$env:QA_CYCLE = $Cycle

Write-Host '=== QA 05 Security / Performance / Mobile ===' -ForegroundColor Cyan

Write-Host '>> API security probes' -ForegroundColor Cyan
node scripts/run-qa-security-api.mjs
$apiExit = $LASTEXITCODE

Write-Host '>> Mobile unit tests' -ForegroundColor Cyan
npm test --prefix mobile
$mobileExit = $LASTEXITCODE
if ($mobileExit -ne 0) {
  $env:QA_MOBILE_UNIT_STATUS = 'fail'
  $env:QA_MOBILE_UNIT_NOTES = "exit $mobileExit"
} else {
  $env:QA_MOBILE_UNIT_STATUS = 'pass'
  $env:QA_MOBILE_UNIT_NOTES = ''
}

Write-Host '>> Playwright security/performance/mobile' -ForegroundColor Cyan
Push-Location web
npx playwright test security-performance.spec.ts
$pwExit = $LASTEXITCODE
Pop-Location

Write-Host '>> Merge Playwright into qa-security-performance.json' -ForegroundColor Cyan
node scripts/merge-qa-05-playwright.mjs

Write-Host '>> Excel + markdown' -ForegroundColor Cyan
npm run qa:report
if ($LASTEXITCODE -ne 0) { throw 'qa:report failed' }

Write-Host '>> Chime' -ForegroundColor Cyan
& "$PSScriptRoot\play-qa-chime.ps1"

if ($apiExit -ne 0 -or $pwExit -ne 0 -or $mobileExit -ne 0) {
  Write-Host "`nQA 05 finished with failures (api=$apiExit pw=$pwExit mobile=$mobileExit). Excel updated." -ForegroundColor Yellow
  exit 1
}

Write-Host "`nQA 05 complete. Excel: docs/QA/WizCRM-QA-Test-$Cycle.xlsx" -ForegroundColor Green
