Set-Location "$PSScriptRoot\..\mobile"
$env:EXPO_PUBLIC_API_URL = "http://10.0.2.2:3000"
Write-Host "Starting Expo (Android emulator: press a)" -ForegroundColor Cyan
npx.cmd expo start
