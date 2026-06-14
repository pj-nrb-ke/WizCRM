# Smoke-test seeded data via API (local or production).
param(
  [string]$BaseUrl = 'http://127.0.0.1:3000'
)

$ErrorActionPreference = 'Stop'

function Login($email) {
  $body = @{ email = $email; password = 'wizcrm123' } | ConvertTo-Json
  $r = Invoke-RestMethod -Uri "$BaseUrl/auth/login" -Method POST -ContentType 'application/json' -Body $body
  return $r.token
}

$token = Login 'manager@wizag.local'
$headers = @{ Authorization = "Bearer $token" }

$pipeline = Invoke-RestMethod -Uri "$BaseUrl/leads/pipeline" -Headers $headers
$leadCount = ($pipeline.pipeline.PSObject.Properties | ForEach-Object { $_.Value.Count } | Measure-Object -Sum).Sum

$leads = Invoke-RestMethod -Uri "$BaseUrl/leads" -Headers $headers
$feed = Invoke-RestMethod -Uri "$BaseUrl/teams/activity-feed?dateFrom=2020-01-01&dateTo=2030-12-31" -Headers $headers
$cal = Invoke-RestMethod -Uri "$BaseUrl/calendar/events" -Headers $headers
$teams = Invoke-RestMethod -Uri "$BaseUrl/teams" -Headers $headers

$sampleLeads = @($leads.leads | Where-Object { $_.email -like '*@sample.wizcrm.app' }).Count

Write-Host "API: $BaseUrl"
Write-Host "  Pipeline cards (open stages): $leadCount"
Write-Host "  Total leads returned: $($leads.leads.Count)"
Write-Host "  Sample leads: $sampleLeads"
Write-Host "  Activity feed items: $($feed.items.Count)"
Write-Host "  Calendar events: $($cal.events.Count)"
Write-Host "  Teams: $($teams.teams.Count)"

if ($leadCount -lt 10) { throw "Expected busy pipeline (>=10 cards), got $leadCount" }
if ($feed.items.Count -lt 20) { throw "Expected busy feed (>=20), got $($feed.items.Count)" }
if ($cal.events.Count -lt 10) { throw "Expected calendar events (>=10), got $($cal.events.Count)" }

Write-Host "SEED_SMOKE_OK"
