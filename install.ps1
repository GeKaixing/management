param(
  [string]$InstallMethod = "zip",
  [string]$InstallDir = "$env:USERPROFILE\rcs",
  [string]$Branch = "main"
)

$repo = "https://github.com/GeKaixing/management"

if (-not (Get-Command node -ErrorAction SilentlyContinue)) {
  Write-Error "Node.js is required."; exit 1
}
if (-not (Get-Command npm -ErrorAction SilentlyContinue)) {
  Write-Error "npm is required."; exit 1
}
if (-not (Get-Command ffmpeg -ErrorAction SilentlyContinue)) {
  Write-Warning "ffmpeg not found. Camera capture may not work."
}

$serverHost = Read-Host "Server host (e.g. 192.168.1.23 or server.local)"
if (-not $serverHost) { Write-Error "Server host is required."; exit 1 }

$deviceId = Read-Host "Device ID (e.g. cam-002)"
if (-not $deviceId) { Write-Error "Device ID is required."; exit 1 }

$enableInput = Read-Host "Enable keyboard/mouse input monitoring? (y/N)"
$enableScreen = Read-Host "Enable screen capture? (y/N)"
$enableMic = Read-Host "Enable microphone recording? (y/N)"
$enableCam = Read-Host "Enable camera frames? (y/N)"

$flags = @()
if ($enableInput -match '^[Yy]$') { $flags += "--input" }
if ($enableScreen -match '^[Yy]$') { $flags += "--screen" }
if ($enableMic -match '^[Yy]$') { $flags += "--mic" }
if ($enableCam -match '^[Yy]$') { $flags += "--camera-frames" }

if ($InstallMethod -eq "git" -and (Get-Command git -ErrorAction SilentlyContinue)) {
  if (Test-Path (Join-Path $InstallDir ".git")) {
    git -C $InstallDir pull origin $Branch
  } else {
    git clone -b $Branch $repo $InstallDir
  }
} else {
  $zip = "$env:TEMP\rcs.zip"
  Invoke-WebRequest -Uri "$repo/archive/refs/heads/$Branch.zip" -OutFile $zip
  if (Test-Path $InstallDir) { Remove-Item -Recurse -Force $InstallDir }
  Expand-Archive -Path $zip -DestinationPath $env:TEMP -Force
  Move-Item -Path (Join-Path $env:TEMP "management-$Branch") -Destination $InstallDir -Force
}

Set-Location $InstallDir

& "C:\Program Files\nodejs\npm.cmd" install

$serverUrl = "http://$serverHost:3000"

node agent/cli.js start --device $deviceId --server $serverUrl @flags