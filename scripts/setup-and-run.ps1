# WizCRM — one-shot setup and start (run from repo root in PowerShell)
$ErrorActionPreference = "Stop"
$Root = Split-Path -Parent $PSScriptRoot
Set-Location $Root

Write-Host "=== WizCRM setup ===" -ForegroundColor Cyan

if (-not (Test-Path "api\.env")) {
  Copy-Item "api\.env.example" "api\.env"
  Write-Host "Created api\.env from example. Add OPENAI_API_KEY for AI features." -ForegroundColor Yellow
}

Write-Host "Installing root packages (api + shared)..."
npm install

Write-Host "Starting database..."
docker compose -f docker/docker-compose.yml up -d
Start-Sleep -Seconds 8

Write-Host "Database migrate + seed..."
Set-Location "$Root\api"
npm run db:push
npm run db:seed

Write-Host "Installing mobile packages..."
Set-Location "$Root\mobile"
npm install

Write-Host "=== Done. Start servers in two terminals: ===" -ForegroundColor Green
Write-Host "  Terminal 1: cd api && npm run dev"
Write-Host "  Terminal 2: cd mobile && npx expo start"
Write-Host "Login: rep@wizag.local / wizcrm123"
