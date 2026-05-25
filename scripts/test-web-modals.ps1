# Regression checks for modal styling (opaque panel, correct class in calendar).
param(
  [switch]$SkipBuild
)

$ErrorActionPreference = 'Stop'
$Root = Split-Path $PSScriptRoot -Parent
Set-Location $Root

if (-not $SkipBuild) {
  npm run build -w web | Out-Host
  if ($LASTEXITCODE -ne 0) { throw 'web build failed' }
}

$calendar = Get-Content (Join-Path $Root 'web/src/pages/CalendarPage.tsx') -Raw
if ($calendar -notmatch 'modal-panel') { throw 'CalendarPage must use modal-panel (opaque shell)' }
if ($calendar -match 'modal-card') { throw 'CalendarPage must not use modal-card (no background styles)' }

$cssPath = Join-Path $Root 'web/dist/assets/index-*.css'
$cssFile = Get-Item $cssPath | Select-Object -First 1
if (-not $cssFile) { throw 'Built CSS not found — run web build first' }
$css = Get-Content $cssFile.FullName -Raw
if ($css -notmatch 'modal-panel|modal-backdrop') { throw 'Built CSS missing modal classes' }
if ($css -notmatch 'background:\s*var\(--surface\)|background:var\(--surface\)|background:#fff|background:#ffffff') {
  throw 'Built CSS missing opaque surface background for modals'
}

Write-Host 'WEB_MODAL_SMOKE_OK'
Write-Host "  CSS: $($cssFile.Name)"
Write-Host '  CalendarPage uses modal-panel'
