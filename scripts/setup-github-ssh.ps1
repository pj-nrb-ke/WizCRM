# One-time GitHub SSH setup for WizCRM (agent can re-run after key exists on GitHub).
$ErrorActionPreference = 'Stop'
$Key = Join-Path $env:USERPROFILE '.ssh\github_pj_nrb_ke'
$Pub = "$Key.pub"
$Config = Join-Path $env:USERPROFILE '.ssh\config'

if (-not (Test-Path $Key)) {
  ssh-keygen -t ed25519 -f $Key -N '""' -C 'wizcrm-git-pj-nrb-ke'
}

$hostBlock = @'

Host github.com-pj-nrb-ke
  HostName github.com
  User git
  IdentityFile ~/.ssh/github_pj_nrb_ke
  IdentitiesOnly yes
'@

if (-not (Test-Path $Config) -or -not (Select-String -Path $Config -Pattern 'github.com-pj-nrb-ke' -Quiet)) {
  Add-Content -Path $Config -Value $hostBlock
}

$pubKey = Get-Content $Pub -Raw
Set-Clipboard -Value $pubKey.Trim()
Write-Host 'Public key copied to clipboard.' -ForegroundColor Green
Write-Host $pubKey.Trim()

Set-Location (Split-Path $PSScriptRoot -Parent)
git remote set-url origin git@github.com-pj-nrb-ke:pj-nrb-ke/WizCRM.git

try {
  Get-Service ssh-agent | Set-Service -StartupType Manual -ErrorAction SilentlyContinue
  Start-Service ssh-agent -ErrorAction SilentlyContinue
  ssh-add $Key 2>$null
} catch { }

Write-Host ''
$tokenFile = Join-Path (Split-Path $PSScriptRoot -Parent) 'api\.github-token.local'
if (Test-Path $tokenFile) {
  & (Join-Path $PSScriptRoot 'register-github-ssh-key.ps1')
} else {
  Write-Host 'Optional: put a GitHub PAT in api\.github-token.local and re-run register-github-ssh-key.ps1 (no browser).' -ForegroundColor DarkGray
  Write-Host 'Or paste the key from clipboard at GitHub -> SSH keys -> New.' -ForegroundColor Yellow
  Start-Process 'https://github.com/settings/ssh/new?title=WizCRM-pj-nrb-ke'
}

Write-Host 'Test: ssh -T git@github.com-pj-nrb-ke' -ForegroundColor Cyan
