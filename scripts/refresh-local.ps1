# Rebuild shared + API + web locally (agent use after code changes).
$ErrorActionPreference = 'Stop'
$Root = Split-Path $PSScriptRoot -Parent
Set-Location $Root

npm run build -w shared
npm run build -w api
if (-not (Test-Path web\.env.local)) {
  Copy-Item web\.env.example web\.env.local -ErrorAction SilentlyContinue
}
npm run web:build
Write-Host 'Local build OK. web/dist updated. Restart web:dev if you use the dev server.' -ForegroundColor Green
