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

. (Join-Path $PSScriptRoot 'Read-HostingConfig.ps1')
$cfg = Get-HostingConfig -RepoRoot $Root
$target = "$($cfg.SSH_USER)@$($cfg.SSH_HOST)"
Write-Host "Deploy → $target ($($cfg._SOURCE))" -ForegroundColor Cyan

$script = Get-Content (Join-Path $PSScriptRoot 'deploy-vps.sh') -Raw
$script = $script -replace "`r`n", "`n" -replace "`r", "`n"
$script | ssh -o BatchMode=yes -p $cfg.SSH_PORT -i $cfg.SSH_IDENTITY_FILE $target 'bash -s'
