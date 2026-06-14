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
  'opp-form label\.checkbox-row',
  '\.checkbox-row input\s*\{[^}]*width:\s*auto',
  'input\[type=''checkbox''\]',
  'input\[type=''radio''\]',
  '\.drawer-backdrop\s*\{[^}]*z-index:\s*450',
  '\.drilldown-backdrop\s*\{[^}]*z-index:\s*650',
  '\.modal-backdrop\s*\{[^}]*z-index:\s*700',
  '@media\s*\(max-width:\s*720px\)\s*\{[^}]*\.form-row'
)

foreach ($p in $requiredPatterns) {
  if ($cssSrc -notmatch $p) { throw "index.css missing required pattern: $p" }
}

$calendar = Get-Content (Join-Path $Root 'web/src/pages/CalendarPage.tsx') -Raw
if ($calendar -notmatch 'modal-panel') { throw 'CalendarPage must use modal-panel' }
if ($calendar -notmatch 'checkbox-row') { throw 'CalendarPage must use checkbox-row for all-day toggle' }
if ($calendar -notmatch 'calendar-form-actions') { throw 'CalendarPage must use calendar-form-actions' }

$opp = Get-Content (Join-Path $Root 'web/src/components/SalesOpportunityForm.tsx') -Raw
if ($opp -notmatch 'checkbox-row') { throw 'SalesOpportunityForm must use checkbox-row' }
if ($opp -notmatch 'form-row') { throw 'SalesOpportunityForm must use form-row for grouped fields' }

$pipeline = Get-Content (Join-Path $Root 'web/src/components/PipelineStagesModal.tsx') -Raw
if ($pipeline -notmatch 'modal-backdrop') { throw 'PipelineStagesModal must use modal-backdrop' }
if ($pipeline -notmatch 'stage-editor-row') { throw 'PipelineStagesModal must render stage-editor-row' }

$leadDrawer = Get-Content (Join-Path $Root 'web/src/components/LeadDrawer.tsx') -Raw
if ($leadDrawer -notmatch 'drawer-backdrop') { throw 'LeadDrawer must use drawer-backdrop' }
if ($leadDrawer -notmatch 'SalesOpportunityForm') { throw 'LeadDrawer must include SalesOpportunityForm flow' }

$leadsPage = Get-Content (Join-Path $Root 'web/src/pages/LeadsPage.tsx') -Raw
if ($leadsPage -notmatch 'toolbar') { throw 'LeadsPage must use toolbar filtering controls' }
if ($leadsPage -notmatch 'LeadDrawer') { throw 'LeadsPage must include LeadDrawer drill-in' }

$managerHome = Get-Content (Join-Path $Root 'web/src/pages/ManagerHomePage.tsx') -Raw
if ($managerHome -notmatch 'TeamActivityFeed') { throw 'ManagerHomePage must include TeamActivityFeed filters' }
if ($managerHome -notmatch 'MetricDrilldown') { throw 'ManagerHomePage must include MetricDrilldown' }

$teamsPage = Get-Content (Join-Path $Root 'web/src/pages/TeamsPage.tsx') -Raw
if ($teamsPage -notmatch 'member-check') { throw 'TeamsPage must use member-check checkboxes' }

$usersPage = Get-Content (Join-Path $Root 'web/src/pages/UsersPage.tsx') -Raw
if ($usersPage -notmatch 'form className="card"') { throw 'UsersPage add-user form must be card form' }

$orgPage = Get-Content (Join-Path $Root 'web/src/pages/OrganizationPage.tsx') -Raw
if ($orgPage -notmatch 'form className="card"') { throw 'OrganizationPage must use card form layout' }

$platformPage = Get-Content (Join-Path $Root 'web/src/pages/PlatformPage.tsx') -Raw
if ($platformPage -notmatch 'checkbox-row') { throw 'PlatformPage must use checkbox-row toggle' }

$loginPage = Get-Content (Join-Path $Root 'web/src/pages/LoginPage.tsx') -Raw
if ($loginPage -notmatch 'login-card') { throw 'LoginPage must use login-card form shell' }

$activityFeed = Get-Content (Join-Path $Root 'web/src/components/TeamActivityFeed.tsx') -Raw
if ($activityFeed -notmatch 'activity-filters') { throw 'TeamActivityFeed must expose activity-filters controls' }
if ($activityFeed -notmatch 'type="date"') { throw 'TeamActivityFeed must include date filters' }

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
if ($built -notmatch 'drawer-backdrop') { throw 'Built CSS missing drawer classes' }
if ($built -notmatch 'drilldown-backdrop') { throw 'Built CSS missing drilldown classes' }
if ($built -notmatch 'checkbox-row') { throw 'Built CSS missing checkbox-row classes' }

Write-Host 'WEB_FORMS_SMOKE_OK'
Write-Host "  CSS source: checkbox + modal guards present"
Write-Host "  Built CSS: $($cssFile.Name)"
