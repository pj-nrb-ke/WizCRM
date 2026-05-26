# Production API smoke test for https://api.wizcrm.app
param(
  [string]$BaseUrl = 'https://api.wizcrm.app',
  [string]$Email = 'manager@wizag.local',
  [string]$Password = 'wizcrm123'
)

$ErrorActionPreference = 'Continue'
$failures = [System.Collections.Generic.List[string]]::new()

function Fail([string]$Message) {
  $script:failures.Add($Message)
  Write-Host "FAIL: $Message" -ForegroundColor Red
}

function Pass([string]$Message) {
  Write-Host "OK: $Message" -ForegroundColor Green
}

function Assert-NonNull($Value, [string]$Label) {
  if ($null -eq $Value) { Fail "$Label is null"; return $false }
  return $true
}

function Assert-NonNegative($Value, [string]$Label) {
  if ($null -eq $Value) { Fail "$Label is null"; return $false }
  $n = [double]$Value
  if ($n -lt 0 -or [double]::IsNaN($n)) { Fail "$Label must be non-negative, got $Value"; return $false }
  return $true
}

function Invoke-Api {
  param(
    [string]$Method = 'GET',
    [string]$Path,
    $Body = $null,
    [hashtable]$Headers = @{}
  )
  $uri = "$BaseUrl$Path"
  $params = @{
    Uri     = $uri
    Method  = $Method
    Headers = $Headers
  }
  if ($null -ne $Body) {
    $params.ContentType = 'application/json'
    $params.Body = ($Body | ConvertTo-Json -Depth 10 -Compress)
  }
  try {
    return Invoke-RestMethod @params
  }
  catch {
    $status = $null
    $detail = $_.Exception.Message
    if ($_.Exception.Response) {
      try {
        $status = [int]$_.Exception.Response.StatusCode
        $reader = New-Object System.IO.StreamReader($_.Exception.Response.GetResponseStream())
        $detail = $reader.ReadToEnd()
        $reader.Close()
      } catch { }
    }
    throw "HTTP $status $Method $Path — $detail"
  }
}

Write-Host "=== WizCRM production smoke ===" -ForegroundColor Cyan
Write-Host "API: $BaseUrl"

# 1. Auth login
$token = $null
$authHeaders = @{}
try {
  $login = Invoke-Api -Method POST -Path '/auth/login' -Body @{ email = $Email; password = $Password }
  if (-not (Assert-NonNull $login.token 'login.token')) { throw 'no token' }
  if (-not (Assert-NonNull $login.user 'login.user')) { throw 'no user' }
  if ($login.user.email -ne $Email) { Fail "login.user.email expected $Email got $($login.user.email)" }
  if (-not $login.user.role) { Fail 'login.user.role missing' }
  $token = $login.token
  $authHeaders = @{ Authorization = "Bearer $token" }
  Pass "auth login ($($login.user.role))"
}
catch {
  Fail "auth login: $_"
}

if (-not $token) {
  Write-Host "`nCannot continue without token." -ForegroundColor Red
  Write-Host "Failures ($($failures.Count)):"
  $failures | ForEach-Object { Write-Host "  - $_" }
  exit 1
}

# 2. GET /teams
try {
  $teamsResp = Invoke-Api -Path '/teams' -Headers $authHeaders
  if (-not (Assert-NonNull $teamsResp.teams 'teams.teams')) { throw 'bad teams' }
  if ($null -eq $teamsResp.unassigned) { Fail 'teams.unassigned missing' }
  if ($teamsResp.teams.Count -lt 1) { Fail 'teams.teams empty' }
  foreach ($team in $teamsResp.teams) {
    if (-not $team.id) { Fail "team missing id ($($team.name))"; continue }
    if (-not $team.stats) { Fail "team $($team.name) missing stats"; continue }
    $statKeys = @('openLeads', 'overdueTasks', 'staleLeads', 'memberCount', 'wonLeads')
    foreach ($k in $statKeys) {
      [void](Assert-NonNegative $team.stats.$k "team $($team.name).stats.$k")
    }
    foreach ($member in @($team.members)) {
      if (-not $member.stats) { Fail "member $($member.email) missing stats"; continue }
      foreach ($k in @('openLeads', 'overdueTasks', 'staleLeads')) {
        [void](Assert-NonNegative $member.stats.$k "member $($member.email).stats.$k")
      }
    }
  }
  foreach ($u in @($teamsResp.unassigned)) {
    if (-not $u.stats) { Fail "unassigned $($u.email) missing stats"; continue }
    foreach ($k in @('openLeads', 'overdueTasks', 'staleLeads')) {
      [void](Assert-NonNegative $u.stats.$k "unassigned $($u.email).stats.$k")
    }
  }
  Pass "GET /teams ($($teamsResp.teams.Count) teams, $($teamsResp.unassigned.Count) unassigned)"
}
catch {
  Fail "GET /teams: $_"
}

# 3. Metrics endpoints
$metricKinds = @('open', 'stale', 'won', 'overdue')
foreach ($metric in $metricKinds) {
  try {
    $m = Invoke-Api -Path "/teams/metrics/$metric" -Headers $authHeaders
    if ($m.metric -ne $metric) { Fail "metrics/$($metric): metric field is '$($m.metric)'" }
    if ($null -eq $m.leads) { Fail "metrics/$($metric): leads missing" }
    if ($null -eq $m.tasks) { Fail "metrics/$($metric): tasks missing" }
    if ($metric -eq 'overdue') {
      if (@($m.leads).Count -ne 0) { Fail "metrics/overdue: expected empty leads array" }
    }
    else {
      if (@($m.tasks).Count -ne 0) { Fail "metrics/$($metric): expected empty tasks array" }
      if ($metric -eq 'stale' -and $null -eq $m.staleDays) { Fail 'metrics/stale: staleDays missing' }
    }
    Pass "GET /teams/metrics/$metric (leads=$(@($m.leads).Count), tasks=$(@($m.tasks).Count))"
  }
  catch {
    Fail "GET /teams/metrics/$metric`: $_"
  }
}

# 4. Calendar CRUD
$createdEventId = $null
try {
  $calList = Invoke-Api -Path '/calendar/events' -Headers $authHeaders
  if ($null -eq $calList.events) { Fail 'calendar/events: events missing' }
  else { Pass "GET /calendar/events (count=$(@($calList.events).Count))" }

  $start = (Get-Date).ToUniversalTime().AddDays(30).Date.AddHours(10)
  $end = $start.AddHours(1)
  $title = "Smoke test $(Get-Date -Format 'yyyy-MM-dd HH:mm:ss') UTC"
  $createBody = @{
    title   = $title
    notes   = 'production-smoke ephemeral event'
    startAt = $start.ToString('yyyy-MM-ddTHH:mm:ss.000Z')
    endAt   = $end.ToString('yyyy-MM-ddTHH:mm:ss.000Z')
    allDay  = $false
  }
  $created = Invoke-Api -Method POST -Path '/calendar/events' -Headers $authHeaders -Body $createBody
  if (-not (Assert-NonNull $created.event 'calendar POST event')) { throw 'create failed' }
  $createdEventId = $created.event.id
  if (-not $createdEventId) { Fail 'calendar POST: event.id missing'; throw 'no id' }
  if ($created.event.title -ne $title) { Fail "calendar POST title mismatch" }
  Pass "POST /calendar/events (id=$createdEventId)"

  $patchedTitle = "$title (patched)"
  $patchBody = @{ title = $patchedTitle }
  $patched = Invoke-Api -Method PATCH -Path "/calendar/events/$createdEventId" -Headers $authHeaders -Body $patchBody
  if (-not (Assert-NonNull $patched.event 'calendar PATCH event')) { throw 'patch failed' }
  if ($patched.event.title -ne $patchedTitle) { Fail 'calendar PATCH: title not updated' }
  Pass 'PATCH /calendar/events/:id'

  $from = $start.AddDays(-1).ToString('yyyy-MM-dd')
  $to = $start.AddDays(2).ToString('yyyy-MM-dd')
  $verify = Invoke-Api -Path "/calendar/events?from=$from&to=$to" -Headers $authHeaders
  $found = @($verify.events | Where-Object { $_.id -eq $createdEventId })
  if ($found.Count -ne 1) { Fail "calendar verify: event not found in range ($from..$to)" }
  elseif ($found[0].title -ne $patchedTitle) { Fail 'calendar verify: patched title not visible in GET' }
  else { Pass 'GET /calendar/events verify patched event' }

  $del = Invoke-Api -Method DELETE -Path "/calendar/events/$createdEventId" -Headers $authHeaders
  if ($del.ok -ne $true) { Fail 'calendar DELETE: ok not true' }
  else { Pass 'DELETE /calendar/events/:id'; $createdEventId = $null }

  $after = Invoke-Api -Path "/calendar/events?from=$from&to=$to" -Headers $authHeaders
  if (@($after.events | Where-Object { $_.id -eq $created.event.id }).Count -gt 0) {
    Fail 'calendar: event still listed after DELETE'
  }
}
catch {
  Fail "calendar flow: $_"
}
finally {
  if ($createdEventId -and $authHeaders.Authorization) {
    try {
      Invoke-Api -Method DELETE -Path "/calendar/events/$createdEventId" -Headers $authHeaders | Out-Null
      Write-Host "Cleaned up calendar event $createdEventId" -ForegroundColor Yellow
    } catch { Write-Host "Cleanup failed for $createdEventId`: $_" -ForegroundColor Yellow }
  }
}

# 5. Reports analytics
try {
  $rep = Invoke-Api -Path '/reports/analytics' -Headers $authHeaders
  if ($null -eq $rep.summary) { Fail 'reports/analytics: summary missing' }
  $s = $rep.summary
  foreach ($k in @('totalLeads', 'openLeads', 'wonCount', 'lostCount', 'byStage', 'bySource', 'byOwner', 'wonLoss')) {
    if ($null -eq $s.$k) { Fail "reports/analytics: summary.$k missing" }
  }
  if ($null -eq $s.activitiesLast30Days) { Fail 'reports/analytics: activitiesLast30Days missing' }
  if ($null -eq $s.staleCount) { Fail 'reports/analytics: staleCount missing' }
  Pass "GET /reports/analytics (totalLeads=$($s.totalLeads), stale=$($s.staleCount))"
}
catch {
  Fail "GET /reports/analytics: $_"
}

# 6. GET /leads/pipeline
try {
  $pipe = Invoke-Api -Path '/leads/pipeline' -Headers $authHeaders
  if ($null -eq $pipe.stages) { Fail 'pipeline: stages missing' }
  if ($null -eq $pipe.pipeline) { Fail 'pipeline: pipeline object missing' }
  $cardCount = 0
  foreach ($prop in $pipe.pipeline.PSObject.Properties) {
    $cardCount += @($prop.Value).Count
  }
  if ($cardCount -lt 1) { Fail "pipeline: expected at least 1 card, got $cardCount" }
  else { Pass "GET /leads/pipeline ($cardCount cards across stages)" }
}
catch {
  Fail "GET /leads/pipeline: $_"
}

# 7. GET /teams/activity-feed
try {
  $feed = Invoke-Api -Path '/teams/activity-feed?dateFrom=2020-01-01&dateTo=2030-12-31' -Headers $authHeaders
  if ($null -eq $feed.items) { Fail 'activity-feed: items missing' }
  else {
    foreach ($item in @($feed.items | Select-Object -First 5)) {
      foreach ($req in @('id', 'kind', 'at', 'user', 'summary')) {
        if (-not $item.$req) { Fail "activity-feed item missing $req"; break }
      }
    }
    Pass "GET /teams/activity-feed (items=$(@($feed.items).Count))"
  }
}
catch {
  Fail "GET /teams/activity-feed: $_"
}

Write-Host ''
if ($failures.Count -eq 0) {
  Write-Host 'PRODUCTION_SMOKE_OK' -ForegroundColor Green
  exit 0
}

Write-Host "PRODUCTION_SMOKE_FAILED ($($failures.Count) failure(s)):" -ForegroundColor Red
$failures | ForEach-Object { Write-Host "  - $_" }
exit 1
