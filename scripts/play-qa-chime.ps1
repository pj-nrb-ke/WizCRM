# Play completion chime (docs/QA.md)
$ErrorActionPreference = 'SilentlyContinue'
$Root = Split-Path $PSScriptRoot -Parent
$candidates = @(
  (Join-Path $Root 'WizCRM-Male.mp3'),
  (Join-Path $Root 'assets\chime.mp3')
)
foreach ($file in $candidates) {
  if (Test-Path $file) {
  try {
    Add-Type -AssemblyName presentationCore
    $player = New-Object System.Windows.Media.MediaPlayer
    $player.Open([Uri]$file)
    $player.Play()
    Start-Sleep -Seconds 2
    Write-Host "Chime: $file" -ForegroundColor Green
    return
  } catch {
    Write-Host "MediaPlayer failed, trying console beep" -ForegroundColor Yellow
  }
  }
}
[console]::beep(880, 200)
Start-Sleep -Milliseconds 80
[console]::beep(1100, 300)
Write-Host 'Chime: system beep' -ForegroundColor Green
