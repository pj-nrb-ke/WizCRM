# Builds a debug APK you can install on a physical Android phone (same Wi‑Fi as this PC).
# Usage: .\scripts\build-apk.ps1
# Optional: .\scripts\build-apk.ps1 -ApiUrl "http://192.168.1.50:3000"

param(
  [string]$ApiUrl = "",
  [switch]$SkipPrebuild
)

$ErrorActionPreference = "Stop"
$Root = Split-Path -Parent $PSScriptRoot
$Mobile = Join-Path $Root "mobile"

function Set-AndroidSdk {
  if ($env:ANDROID_HOME -and (Test-Path $env:ANDROID_HOME)) { return }
  $sdk = Join-Path $env:LOCALAPPDATA "Android\Sdk"
  if (Test-Path $sdk) {
    $env:ANDROID_HOME = $sdk
    Write-Host "ANDROID_HOME=$env:ANDROID_HOME" -ForegroundColor DarkGray
  }
}

function Set-JavaHome {
  if ($env:JAVA_HOME -and (Test-Path "$env:JAVA_HOME\bin\java.exe")) { return }
  $candidates = @(
    "C:\Program Files\Microsoft\jdk-17.0.19.10-hotspot",
    (Get-ChildItem "$env:ProgramFiles\Microsoft\jdk-*" -ErrorAction SilentlyContinue | Select-Object -First 1 -ExpandProperty FullName),
    "$env:ProgramFiles\Android\Android Studio\jbr",
    (Get-ChildItem "$env:ProgramFiles\Java\jdk-*" -ErrorAction SilentlyContinue | Select-Object -First 1 -ExpandProperty FullName)
  ) | Where-Object { $_ -and (Test-Path "$_\bin\java.exe") }
  if ($candidates) {
    $env:JAVA_HOME = $candidates[0]
    $env:Path = "$env:JAVA_HOME\bin;$env:Path"
    Write-Host "JAVA_HOME=$env:JAVA_HOME" -ForegroundColor DarkGray
  } else {
    throw "JAVA_HOME not set. Install JDK 17 (Microsoft.OpenJDK.17) or set JAVA_HOME, then retry."
  }
}

function Test-AndroidProjectValid {
  param([string]$Dir)
  Test-Path (Join-Path $Dir "gradlew.bat") -and
    Test-Path (Join-Path $Dir "app\src\main\AndroidManifest.xml")
}

function Use-TempAndroidWorkspace {
  param([string]$MobileRoot)
  $tempRoot = Join-Path $env:TEMP "wizcrm-apk-build\mobile"
  if (Test-Path $tempRoot) { Remove-Item $tempRoot -Recurse -Force -ErrorAction SilentlyContinue }
  New-Item -ItemType Directory -Path $tempRoot -Force | Out-Null
  Write-Host "Prebuild in temp workspace (android/ locked or corrupt)..." -ForegroundColor Yellow
  robocopy $MobileRoot $tempRoot /E /XD android node_modules .expo /NFL /NDL /NJH /NJS /NC /NS | Out-Null
  if ($LASTEXITCODE -ge 8) { throw "robocopy failed copying mobile sources to temp" }
  cmd /c "mklink /J `"$tempRoot\node_modules`" `"$MobileRoot\node_modules`"" | Out-Null
  Push-Location $tempRoot
  try {
    npx.cmd expo prebuild --platform android --clean
    if ($LASTEXITCODE -ne 0) { throw "expo prebuild failed in temp workspace" }
  } finally {
    Pop-Location
  }
  return $tempRoot
}

function Set-PhoneGradleArchitectures {
  param([string]$GradlePropsPath)
  if (-not (Test-Path $GradlePropsPath)) { return }
  $props = Get-Content $GradlePropsPath -Raw
  $props = $props -replace 'reactNativeArchitectures=.*', 'reactNativeArchitectures=arm64-v8a'
  $props = $props -replace 'org.gradle.parallel=.*', 'org.gradle.parallel=false'
  if ($props -notmatch 'org.gradle.parallel=') { $props += "`norg.gradle.parallel=false`n" }
  Set-Content -Path $GradlePropsPath -Value $props.TrimEnd()
}

function Get-LanIp {
  $addrs = Get-NetIPAddress -AddressFamily IPv4 -ErrorAction SilentlyContinue |
    Where-Object {
      $_.IPAddress -notlike '127.*' -and
      $_.IPAddress -notlike '169.254*' -and
      $_.IPAddress -notlike '172.1[6-9].*' -and
      $_.PrefixOrigin -ne 'WellKnown'
    }
  foreach ($a in $addrs) {
    $adapter = Get-NetAdapter -InterfaceIndex $a.InterfaceIndex -ErrorAction SilentlyContinue
    if (-not $adapter) { continue }
    if ($adapter.Name -match 'vEthernet|Virtual|VPN|WSL|Hyper-V|Docker') { continue }
    if ($adapter.Name -match 'Wi-?Fi|WLAN|Ethernet') {
      return $a.IPAddress
    }
  }
  # Prefer typical home LAN 192.168.x.x / 10.x
  $home = $addrs | Where-Object { $_.IPAddress -match '^(192\.168|10\.)\d+\.\d+$' } |
    Select-Object -First 1 -ExpandProperty IPAddress
  if ($home) { return $home }
  return ($addrs | Select-Object -First 1 -ExpandProperty IPAddress)
}

if (-not $ApiUrl) {
  $lan = Get-LanIp
  if ($lan) {
    $ApiUrl = "http://${lan}:3000"
    Write-Host "Using PC API URL for phone: $ApiUrl" -ForegroundColor Cyan
    Write-Host "(Phone and PC must be on the same Wi‑Fi. API must be running: scripts\start-api.ps1)" -ForegroundColor DarkGray
  } else {
    $ApiUrl = "http://10.0.2.2:3000"
    Write-Host "Could not detect LAN IP. Pass -ApiUrl http://YOUR_PC_IP:3000" -ForegroundColor Yellow
  }
}

$env:EXPO_PUBLIC_API_URL = $ApiUrl
$env:NODE_ENV = "production"

Set-JavaHome
Set-AndroidSdk

$androidDir = Join-Path $Mobile "android"
$buildMobile = $Mobile

# Restore native project if start-mobile.ps1 stashed it for Expo Go.
$androidStash = Join-Path $Mobile ".android-apk-stash"
if ((Test-Path $androidStash) -and -not (Test-Path $androidDir)) {
  Rename-Item $androidStash "android"
  Write-Host "Restored android/ from .android-apk-stash" -ForegroundColor DarkGray
}

$needsPrebuild = -not $SkipPrebuild -or -not (Test-AndroidProjectValid $androidDir)
$useTemp = $false

if ($needsPrebuild) {
  Set-Location $Mobile
  Write-Host "Installing mobile dependencies..." -ForegroundColor Cyan
  npm install

  if (-not (Test-AndroidProjectValid $androidDir)) {
    Write-Host "Generating native Android project (expo prebuild)..." -ForegroundColor Cyan
    $prebuildArgs = @("prebuild", "--platform", "android", "--clean")
    npx.cmd expo @prebuildArgs
    if ($LASTEXITCODE -ne 0) {
      $useTemp = $true
      $buildMobile = Use-TempAndroidWorkspace -MobileRoot $Mobile
    }
  } else {
    Write-Host "(Valid android/ found; skipping prebuild. Pass -SkipPrebuild or delete android/ to regen.)" -ForegroundColor DarkGray
  }
} elseif (-not (Test-AndroidProjectValid $androidDir)) {
  throw "android/ is missing or corrupt. Run without -SkipPrebuild."
}

if ($useTemp) {
  $androidDir = Join-Path $buildMobile "android"
} else {
  $androidDir = Join-Path $Mobile "android"
}

Set-PhoneGradleArchitectures (Join-Path $androidDir "gradle.properties")

Write-Host "Building debug APK (may take 10-20 minutes)..." -ForegroundColor Cyan
Write-Host "  EXPO_PUBLIC_API_URL=$env:EXPO_PUBLIC_API_URL" -ForegroundColor DarkGray
Set-Location $androidDir
& .\gradlew.bat assembleDebug
if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }

$apk = Join-Path $androidDir "app\build\outputs\apk\debug\app-debug.apk"
if (Test-Path $apk) {
  $dest = Join-Path $Root "WizCRM-lite-debug.apk"
  Copy-Item $apk $dest -Force
  Write-Host ""
  Write-Host "SUCCESS" -ForegroundColor Green
  $sizeMb = [math]::Round((Get-Item $dest).Length / 1MB, 2)
  Write-Host "  APK: $dest ($sizeMb MB)" -ForegroundColor Green
  Write-Host "  API URL baked in: $env:EXPO_PUBLIC_API_URL" -ForegroundColor Green
  Write-Host ""
  Write-Host "Install on phone:" -ForegroundColor Cyan
  Write-Host "  1. Copy WizCRM-lite-debug.apk to the phone (USB, email, or cloud)."
  Write-Host "  2. On phone: allow Install from unknown sources if asked."
  Write-Host "  3. Open the APK and install."
  Write-Host "  4. Keep API running on PC: scripts\start-api.ps1"
  Write-Host "  5. Login: rep@wizag.local / wizcrm123"
  Write-Host ""
  Write-Host "To use Expo Go in the emulator again, run: scripts\start-mobile.ps1" -ForegroundColor DarkGray
} else {
  Write-Host "APK not found at expected path: $apk" -ForegroundColor Red
  exit 1
}

# Gradle leaves android/build folders inside node_modules; Metro crashes on reload until cleared.
$nm = Join-Path $Mobile "node_modules"
if (Test-Path $nm) {
  Get-ChildItem $nm -Directory -ErrorAction SilentlyContinue | ForEach-Object {
    foreach ($platform in @("android", "ios")) {
      $build = Join-Path $_.FullName "$platform\build"
      if (Test-Path $build) { Remove-Item $build -Recurse -Force -ErrorAction SilentlyContinue }
    }
  }
}
