# Run once after Android Studio finishes its first-time setup (SDK download).
# Restart the terminal after running.

$jdkHome = "C:\Program Files\Microsoft\jdk-17.0.19.10-hotspot"
$androidHome = "$env:LOCALAPPDATA\Android\Sdk"

[Environment]::SetEnvironmentVariable("JAVA_HOME", $jdkHome, "User")
[Environment]::SetEnvironmentVariable("ANDROID_HOME", $androidHome, "User")

$userPath = [Environment]::GetEnvironmentVariable("Path", "User")
$segments = @(
    "$jdkHome\bin",
    "$androidHome\platform-tools",
    "$androidHome\emulator",
    "$androidHome\cmdline-tools\latest\bin"
)

foreach ($segment in $segments) {
    if ($userPath -notlike "*$segment*") {
        $userPath = if ($userPath) { "$userPath;$segment" } else { $segment }
    }
}

[Environment]::SetEnvironmentVariable("Path", $userPath, "User")

Write-Host "JAVA_HOME=$jdkHome"
Write-Host "ANDROID_HOME=$androidHome"
Write-Host "Done. Open a new PowerShell window and run: adb version"
