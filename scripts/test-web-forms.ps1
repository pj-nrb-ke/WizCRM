# Form + modal CSS regression checks (opaque modals, checkbox alignment in modals/drawers).
param(
  [switch]$SkipBuild
)

$ErrorActionPreference = 'Stop'
$Root = Split-Path $PSScriptRoot -Parent
Set-Location $Root

$cssSrc = Get-Content (Join-Path $Root 'web/src/index.css') -Raw

$requiredPatterns = @(
  'modal-panel label:not\(\.checkbox-row\)',
  'input:not\(\[type=''checkbox''\]\)',
  'modal-panel label\.checkbox-row',
  'display:\s*flex',
  'opp-form label\.checkbox-row',
  '\.checkbox-row input\s*\{[^}]*width:\s*auto'
)

foreach ($p in $requiredPatterns) {
  if ($cssSrc -notmatch $p) { throw "index.css missing required pattern: $p" }
}

$calendar = Get-Content (Join-Path $Root 'web/src/pages/CalendarPage.tsx') -Raw
if ($calendar -notmatch 'modal-panel') { throw 'CalendarPage must use modal-panel' }
if ($calendar -notmatch 'checkbox-row') { throw 'CalendarPage must use checkbox-row for all-day toggle' }

$opp = Get-Content (Join-Path $Root 'web/src/components/SalesOpportunityForm.tsx') -Raw
if ($opp -notmatch 'checkbox-row') { throw 'SalesOpportunityForm must use checkbox-row' }

if (-not $SkipBuild) {
  npm run build -w web | Out-Host
  if ($LASTEXITCODE -ne 0) { throw 'web build failed' }
}

$cssFile = Get-Item (Join-Path $Root 'web/dist/assets/index-*.css') | Select-Object -First 1
if (-not $cssFile) { throw 'Built CSS not found' }
$built = Get-Content $cssFile.FullName -Raw
if ($built -notmatch 'modal-panel|modal-backdrop') { throw 'Built CSS missing modal classes' }
if ($built -notmatch 'background:\s*var\(--surface\)|background:var\(--surface\)|background:#fff') {
  throw 'Built CSS missing opaque modal surface'
}

Write-Host 'WEB_FORMS_SMOKE_OK'
Write-Host "  CSS source: checkbox + modal guards present"
Write-Host "  Built CSS: $($cssFile.Name)"
