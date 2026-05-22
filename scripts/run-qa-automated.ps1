# Full automated QA gate (P2 + P5 + P6). Requires Docker Postgres on 5434.
$ErrorActionPreference = 'Stop'
$Root = Split-Path $PSScriptRoot -Parent
Set-Location $Root

function Invoke-Step([string]$Label, [scriptblock]$Block) {
  Write-Host ">> $Label" -ForegroundColor Cyan
  & $Block
  if ($LASTEXITCODE -ne 0) {
    throw "Failed: $Label (exit $LASTEXITCODE)"
  }
}

Write-Host '=== WizCRM automated QA ===' -ForegroundColor Cyan

# Local npm may set omit=dev; web build needs @types/react.
if (-not (Test-Path 'node_modules\@types\react')) {
  Invoke-Step 'npm install (include dev)' { npm install --include=dev }
}

Invoke-Step 'Docker Postgres' { docker compose -f docker/docker-compose.yml up -d }
$ready = $false
for ($i = 0; $i -lt 45; $i++) {
  docker exec wizcrm-postgres pg_isready -U wizcrm -d wizcrm 2>$null | Out-Null
  if ($LASTEXITCODE -eq 0) {
    $ready = $true
    break
  }
  Start-Sleep -Seconds 1
}
if (-not $ready) {
  throw 'Postgres not ready on 5434 (wizcrm-postgres)'
}

$env:DATABASE_URL = 'postgresql://wizcrm:wizcrm_dev@127.0.0.1:5434/wizcrm'
$env:JWT_SECRET = 'dev-jwt-secret-change-in-production'
$env:RUN_INTEGRATION_TESTS = '1'

Invoke-Step 'shared build' { npm run build -w shared }
Invoke-Step 'db push' { npx prisma db push --schema api/prisma/schema.prisma }
Invoke-Step 'db seed' { npm run db:seed -w api }
Invoke-Step 'api build' { npm run build -w api }
Invoke-Step 'shared test' { npm run test -w shared }
Invoke-Step 'api test' { npm run test -w api }
Invoke-Step 'mobile test' { npm test --prefix mobile }
Invoke-Step 'web build' { npm run build -w web }
Invoke-Step 'email validate' { npx tsx api/scripts/validate-brevo.ts }

Write-Host ''
Write-Host 'Automated QA PASSED' -ForegroundColor Green
Write-Host 'User testing still required: QA-LITE-ANDROID, QA-LITE-PILOT (device)' -ForegroundColor Yellow
