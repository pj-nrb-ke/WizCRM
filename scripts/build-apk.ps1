# Builds a standalone APK for a physical Android phone (JS bundle embedded; no Metro required).
# Bakes EXPO_PUBLIC_API_URL into the JS bundle as fallback. Override at runtime via
# Download/WizCRM/api-url.txt on the phone (see MOBILE_DEV.md, scripts/push-api-url.ps1).
#
# Usage (pick one):
#   .\scripts\build-apk.ps1 -PcIp 192.168.68.58
#   .\scripts\build-apk.ps1 -PcIp 192.168.68.58 -Port 3000
#   .\scripts\build-apk.ps1 -ApiUrl "http://192.168.68.58:3000"
#   .\scripts\build-apk.ps1                    # auto-detect PC Wi-Fi IP
#   .\scripts\build-apk.ps1 -Production       # production API + copy WizCRM-production.apk

param(
  [string]$ApiUrl = "",
  [string]$PcIp = "",
  [int]$Port = 3000,
  [switch]$SkipPrebuild,
  [switch]$Production
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
  (Test-Path (Join-Path $Dir "gradlew.bat")) -and
    (Test-Path (Join-Path $Dir "app\src\main\AndroidManifest.xml"))
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

# Release APK uses bundleCommand export:embed (Expo). Sign with debug keystore for local install.
function Test-ApkContainsApiUrl {
  param([string]$ApkPath, [string]$ExpectedUrl)
  Add-Type -AssemblyName System.IO.Compression.FileSystem
  $zip = [System.IO.Compression.ZipFile]::OpenRead($ApkPath)
  try {
    $entry = $zip.Entries | Where-Object { $_.FullName -eq 'assets/index.android.bundle' } | Select-Object -First 1
    if (-not $entry) { return $false }
    $reader = New-Object System.IO.StreamReader($entry.Open())
    try {
      $bundle = $reader.ReadToEnd()
    } finally {
      $reader.Close()
    }
    return $bundle.Contains($ExpectedUrl)
  } finally {
    $zip.Dispose()
  }
}

function Enable-AndroidCleartextHttp {
  param([string]$AndroidDir)
  $resXml = Join-Path $AndroidDir "app\src\main\res\xml"
  $nscPath = Join-Path $resXml "network_security_config.xml"
  if (-not (Test-Path $resXml)) {
    New-Item -ItemType Directory -Path $resXml -Force | Out-Null
  }
  @"
<?xml version="1.0" encoding="utf-8"?>
<network-security-config>
    <base-config cleartextTrafficPermitted="true" />
</network-security-config>
"@ | Set-Content -Path $nscPath -Encoding utf8

  $manifest = Join-Path $AndroidDir "app\src\main\AndroidManifest.xml"
  if (-not (Test-Path $manifest)) { return }
  $c = Get-Content $manifest -Raw
  if ($c -notmatch 'usesCleartextTraffic') {
    $c = $c -replace '<application ', '<application android:usesCleartextTraffic="true" '
    Write-Host "Enabled usesCleartextTraffic (HTTP to PC API on LAN)" -ForegroundColor DarkGray
  }
  if ($c -notmatch 'networkSecurityConfig') {
    $c = $c -replace '<application ', '<application android:networkSecurityConfig="@xml/network_security_config" '
  }
  Set-Content -Path $manifest -Value $c.TrimEnd() -NoNewline
}

function Enable-LocalReleaseSigning {
  param([string]$AndroidDir)
  $appGradle = Join-Path $AndroidDir "app\build.gradle"
  if (-not (Test-Path $appGradle)) { return }
  $c = Get-Content $appGradle -Raw
  if ($c -match 'bundleInDebug') {
    $c = $c -replace '\s*bundleInDebug\s*=\s*true\s*\r?\n', "`n"
    Write-Host "Removed unsupported bundleInDebug from build.gradle" -ForegroundColor DarkGray
  }
  if ($c -match 'release\s*\{' -and $c -notmatch 'release\s*\{[^}]*signingConfig\s+signingConfigs\.debug') {
    $c = $c -replace '(release\s*\{)', "`$1`n            signingConfig signingConfigs.debug"
    Write-Host "Release build will use debug signing (local install only)" -ForegroundColor DarkGray
  }
  Set-Content -Path $appGradle -Value $c.TrimEnd() -NoNewline
}

function Resolve-ApiUrl {
  param([string]$Url, [string]$Ip, [int]$ApiPort)
  if ($Url) {
    if ($Url -notmatch '^https?://') { $Url = "http://$Url" }
    if ($Url -notmatch ':\d+(/|$)') { $Url = "$Url`:$ApiPort" }
    return $Url.TrimEnd('/')
  }
  if ($Ip) {
    $Ip = $Ip.Trim()
    if ($Ip -match '^https?://') {
      return (Resolve-ApiUrl -Url $Ip -Ip '' -ApiPort $ApiPort)
    }
    return "http://${Ip}:$ApiPort"
  }
  $lan = Get-LanIp
  if ($lan) {
    Write-Host "Auto-detected PC IP: $lan" -ForegroundColor Cyan
    return "http://${lan}:$ApiPort"
  }
  Write-Host "Could not detect LAN IP. Pass -PcIp 192.168.x.x or -ApiUrl http://YOUR_PC_IP:3000" -ForegroundColor Yellow
  return "http://10.0.2.2:$ApiPort"
}

function Set-BuildApiEnv {
  param([string]$MobileRoot, [string]$Url)
  $env:EXPO_PUBLIC_API_URL = $Url
  $env:NODE_ENV = "production"
  # Expo/Metro read this during export:embed (Gradle release bundle).
  $envFile = Join-Path $MobileRoot ".env.production.local"
  @(
    "# Generated by scripts/build-apk.ps1 - do not edit; rebuild APK to change API URL"
    "EXPO_PUBLIC_API_URL=$Url"
  ) | Set-Content -Path $envFile -Encoding utf8
  Write-Host "API URL for this build: $Url" -ForegroundColor Cyan
  Write-Host "  (written to mobile/.env.production.local + process env)" -ForegroundColor DarkGray
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

if ($Production) {
  $ApiUrl = "https://api.wizcrm.app"
  Write-Host "Production build -> $ApiUrl" -ForegroundColor Cyan
} else {
  $ApiUrl = Resolve-ApiUrl -Url $ApiUrl -Ip $PcIp -ApiPort $Port
  Write-Host "(Phone and PC must be on the same Wi-Fi. API must be running: scripts\start-api.ps1)" -ForegroundColor DarkGray
}
Set-BuildApiEnv -MobileRoot $Mobile -Url $ApiUrl

Set-JavaHome
Set-AndroidSdk

function Restore-AndroidFromStash {
  param([string]$MobileRoot)
  $androidDir = Join-Path $MobileRoot "android"
  $androidStash = Join-Path $MobileRoot ".android-apk-stash"
  if (Test-AndroidProjectValid $androidDir) { return $true }
  if (-not (Test-Path $androidStash)) { return $false }

  Write-Host "Restoring android/ from .android-apk-stash (copy, not move)..." -ForegroundColor Yellow
  if (Test-Path $androidDir) {
    Remove-Item $androidDir -Recurse -Force -ErrorAction SilentlyContinue
  }
  $robocopy = robocopy $androidStash $androidDir /E /NFL /NDL /NJH /NJS /NC /NS
  if ($LASTEXITCODE -ge 8) {
    Write-Host "Stash copy failed (exit $LASTEXITCODE). Will run expo prebuild instead." -ForegroundColor Yellow
    return $false
  }
  return (Test-AndroidProjectValid $androidDir)
}

# Stop Metro so it does not lock mobile/android or .android-apk-stash
$on8081 = Get-NetTCPConnection -LocalPort 8081 -State Listen -ErrorAction SilentlyContinue
if ($on8081) {
  $pid8081 = $on8081.OwningProcess | Select-Object -First 1
  $proc = Get-Process -Id $pid8081 -ErrorAction SilentlyContinue
  if ($proc -and $proc.ProcessName -match 'node') {
    Write-Host "Stopping Metro on port 8081 (close this before building APK)..." -ForegroundColor Yellow
    Stop-Process -Id $pid8081 -Force -ErrorAction SilentlyContinue
    Start-Sleep -Seconds 2
  }
}

$androidDir = Join-Path $Mobile "android"
$buildMobile = $Mobile

Restore-AndroidFromStash $Mobile | Out-Null

$needsPrebuild = -not $SkipPrebuild -or -not (Test-AndroidProjectValid $androidDir)
$useTemp = $false

if ($needsPrebuild) {
  Set-Location $Mobile
  Write-Host "Installing mobile dependencies..." -ForegroundColor Cyan
  npm install

  if (-not (Test-AndroidProjectValid $androidDir)) {
    Write-Host "Generating native Android project (expo prebuild)..." -ForegroundColor Cyan
    Write-Host "  (Stop Metro / close Android Studio if prebuild fails with access denied)" -ForegroundColor DarkGray
    Set-BuildApiEnv -MobileRoot $Mobile -Url $ApiUrl
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
Enable-AndroidCleartextHttp $androidDir
Enable-LocalReleaseSigning $androidDir

Write-Host "Building standalone release APK (bundles JS; no Metro on phone)..." -ForegroundColor Cyan
Set-BuildApiEnv -MobileRoot $buildMobile -Url $ApiUrl
Write-Host "  (gradlew clean assembleRelease - forces fresh JS bundle)" -ForegroundColor DarkGray
Set-Location $androidDir
# Gradle often reuses a cached index.android.bundle; clean forces EXPO_PUBLIC_API_URL into the APK.
& .\gradlew.bat clean assembleRelease
if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }

$apk = Join-Path $androidDir "app\build\outputs\apk\release\app-release.apk"
if (-not (Test-Path $apk)) {
  $apk = Join-Path $androidDir "app\build\outputs\apk\debug\app-debug.apk"
}
if (Test-Path $apk) {
  $dest = if ($Production) {
    Join-Path $Root "WizCRM-production.apk"
  } else {
    Join-Path $Root "WizCRM-lite.apk"
  }
  Copy-Item $apk $dest -Force
  if (-not $Production) {
    Copy-Item $apk (Join-Path $Root "WizCRM-lite-debug.apk") -Force
  }
  Write-Host ""
  Write-Host "SUCCESS" -ForegroundColor Green
  $sizeMb = [math]::Round((Get-Item $dest).Length / 1MB, 2)
  Write-Host "  APK: $dest ($sizeMb MB)" -ForegroundColor Green
  $baked = Test-ApkContainsApiUrl -ApkPath $apk -ExpectedUrl $env:EXPO_PUBLIC_API_URL
  if ($baked) {
    Write-Host "  API URL verified in JS bundle: $env:EXPO_PUBLIC_API_URL" -ForegroundColor Green
  } else {
    Write-Host "  WARNING: JS bundle may not contain $env:EXPO_PUBLIC_API_URL - rebuild failed verification" -ForegroundColor Red
    exit 1
  }
  Write-Host "  JS bundle is inside the APK (Metro not required on phone)" -ForegroundColor Green
  Write-Host ""
  Write-Host "Install on phone:" -ForegroundColor Cyan
  Write-Host "  1. Uninstall the old WizCRM APK if installed."
  Write-Host "  2. Copy $((Split-Path $dest -Leaf)) to the phone (USB, email, or cloud)."
  Write-Host "  3. On phone: allow Install from unknown sources if asked."
  Write-Host "  4. Open the APK and install."
  if ($Production) {
    Write-Host "  5. Login (Wi‑Fi or mobile data): rep@wizag.local or manager@wizag.local / wizcrm123"
    Write-Host "  6. Optional: Settings → confirm API https://api.wizcrm.app"
    Write-Host "  Pilot: docs/MOBILE-PILOT.md"
  } else {
    Write-Host "  5. Keep API running on PC: scripts\start-api.ps1"
    Write-Host "  6. Login: rep@wizag.local / wizcrm123"
  }
  Write-Host ""
  Write-Host "To use Expo Go in the emulator again, run: scripts\start-mobile.ps1" -ForegroundColor DarkGray
} else {
  Write-Host "APK not found under app/build/outputs/apk/" -ForegroundColor Red
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
