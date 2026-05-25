# Deep test suite: unit tests (shared/api/web), form CSS regression, production API smoke.
param(
  [switch]$SkipProduction,
  [switch]$SkipBuild
)

$ErrorActionPreference = 'Stop'
$Root = Split-Path $PSScriptRoot -Parent
Set-Location $Root

Write-Host '=== Deep test: shared ===' -ForegroundColor Cyan
npm run test -w shared
if ($LASTEXITCODE -ne 0) { throw 'shared tests failed' }

Write-Host '=== Deep test: api ===' -ForegroundColor Cyan
npm run test -w api
if ($LASTEXITCODE -ne 0) { throw 'api tests failed' }

Write-Host '=== Deep test: web ===' -ForegroundColor Cyan
npm run test -w web
if ($LASTEXITCODE -ne 0) { throw 'web tests failed' }

Write-Host '=== Deep test: web forms CSS ===' -ForegroundColor Cyan
if ($SkipBuild) {
  & (Join-Path $PSScriptRoot 'test-web-forms.ps1') -SkipBuild
} else {
  & (Join-Path $PSScriptRoot 'test-web-forms.ps1')
}
if ($LASTEXITCODE -ne 0) { throw 'web forms smoke failed' }

if (-not $SkipProduction) {
  Write-Host '=== Deep test: production API ===' -ForegroundColor Cyan
  & (Join-Path $PSScriptRoot 'test-production-smoke.ps1')
  if ($LASTEXITCODE -ne 0) { throw 'production smoke failed' }
}

Write-Host ''
Write-Host 'DEEP_TEST_OK' -ForegroundColor Green
