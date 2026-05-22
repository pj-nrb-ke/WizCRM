# Push + deploy WizCRM to Contabo (agent/CI use — not required for product owners).
param(
  [switch]$SkipPush
)

$ErrorActionPreference = 'Stop'
$Root = Split-Path $PSScriptRoot -Parent
Set-Location $Root

if (-not $SkipPush) {
  $status = git status --porcelain
  if ($status) {
    Write-Host 'Uncommitted changes — commit and push before deploy, or pass -SkipPush.' -ForegroundColor Yellow
    exit 1
  }
  git push origin development
}

$Key = Join-Path $env:USERPROFILE '.ssh\contabo_wizcrm'
$script = Get-Content (Join-Path $PSScriptRoot 'deploy-vps.sh') -Raw
$script | ssh -o BatchMode=yes -i $Key root@161.97.141.220 'bash -s'
