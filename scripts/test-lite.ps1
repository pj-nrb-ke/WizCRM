# P1/P2 automated gate: shared + api unit tests + mobile unit tests.
# Integration (DB): start docker first, then:
#   $env:RUN_INTEGRATION_TESTS='1'; .\scripts\test-lite.ps1 -Integration
param([switch]$Integration)

$ErrorActionPreference = 'Stop'
$Root = Split-Path $PSScriptRoot -Parent
Set-Location $Root

npm run build -w shared
npm run test -w shared
npm run test -w api
if ($Integration) {
  if (-not $env:DATABASE_URL) {
    $env:DATABASE_URL = 'postgresql://wizcrm:wizcrm_dev@127.0.0.1:5434/wizcrm'
  }
  $env:RUN_INTEGRATION_TESTS = '1'
  npm run test -w api
}
Set-Location mobile
npm test
Set-Location $Root
Write-Host 'Lite automated tests OK' -ForegroundColor Green
