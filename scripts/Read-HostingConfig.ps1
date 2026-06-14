# Parse hosting.local.txt for deploy scripts and agents (gitignored file).
function Get-HostingConfig {
  param(
    [string]$RepoRoot = (Split-Path $PSScriptRoot -Parent)
  )

  function Expand-HomePath([string]$Path) {
    if ($Path -match '^%USERPROFILE%\\?(.*)$') {
      return Join-Path $env:USERPROFILE $Matches[1]
    }
    if ($Path -match '^~\\?(.*)$') {
      return Join-Path $env:USERPROFILE $Matches[1]
    }
    return $Path
  }

  $candidates = @(
    (Join-Path $RepoRoot 'docs\hosting.local.txt'),
    (Join-Path $RepoRoot 'config\secrets\hosting.local.txt'),
    (Join-Path $RepoRoot 'secrets\hosting.local.txt')
  )

  foreach ($path in $candidates) {
    if (-not (Test-Path -LiteralPath $path)) { continue }
    $cfg = @{ _SOURCE = $path }
    foreach ($line in Get-Content -LiteralPath $path -Encoding UTF8) {
      $t = $line.Trim()
      if (-not $t -or $t.StartsWith('#')) { continue }
      $eq = $t.IndexOf('=')
      if ($eq -lt 1) { continue }
      $key = $t.Substring(0, $eq).Trim().ToUpperInvariant()
      $val = $t.Substring($eq + 1).Trim()
      if (
        ($val.StartsWith('"') -and $val.EndsWith('"')) -or
        ($val.StartsWith("'") -and $val.EndsWith("'"))
      ) {
        $val = $val.Substring(1, $val.Length - 2)
      }
      if ($key -eq 'SSH_IDENTITY_FILE') {
        $val = Expand-HomePath $val
      }
      $cfg[$key] = $val
    }
    if (-not $cfg.SSH_PORT) { $cfg.SSH_PORT = '22' }
    if (-not $cfg.GIT_REMOTE) { $cfg.GIT_REMOTE = 'origin' }
    return $cfg
  }

  throw @"
No hosting.local.txt found. Copy docs/hosting.local.example.txt to docs/hosting.local.txt and fill SSH_* / APP_* values.
Searched:
  $($candidates -join "`n  ")
"@
}
