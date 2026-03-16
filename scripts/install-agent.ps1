param(
  [string]$InstallDir = "C:\rcs",
  [string]$DeviceId = "cam-001",
  [string]$Camera = "video=Integrated Camera",
  [switch]$EnableInput
)

$repo = "https://github.com/GeKaixing/management"
$zip = "$env:TEMP\rcs.zip"

Write-Host "Downloading repo..."
Invoke-WebRequest -Uri "$repo/archive/refs/heads/main.zip" -OutFile $zip

if (Test-Path $InstallDir) {
  Write-Host "Removing existing install: $InstallDir"
  Remove-Item -Recurse -Force $InstallDir
}

Write-Host "Extracting..."
Expand-Archive -Path $zip -DestinationPath "C:\"
Rename-Item -Path "C:\management-main" -NewName (Split-Path $InstallDir -Leaf)

Set-Location $InstallDir

Write-Host "Installing dependencies..."
& "C:\Program Files\nodejs\npm.cmd" install

$ip = (Get-NetIPAddress -AddressFamily IPv4 `
  | Where-Object { $_.IPAddress -notlike "169.254.*" -and $_.InterfaceAlias -notlike "*Loopback*" } `
  | Select-Object -First 1 -ExpandProperty IPAddress)

if (-not $ip) {
  Write-Error "Unable to determine LAN IP."
  exit 1
}

$serverUrl = "http://$ip:3000"

Write-Host "Detected LAN IP: $ip"
Write-Host "Server URL: $serverUrl"

$inputFlag = ""
if ($EnableInput) { $inputFlag = "--input" }

Write-Host "Starting agent..."
Start-Process -FilePath node -ArgumentList @(
  "agent/cli.js",
  "start",
  "--device", $DeviceId,
  "--server", $serverUrl,
  "--camera", $Camera
) + @($inputFlag) -WorkingDirectory $InstallDir

$action = "powershell.exe -NoProfile -WindowStyle Hidden -Command `"cd $InstallDir; node agent/cli.js start --device $DeviceId --server $serverUrl --camera '$Camera' $inputFlag`""

Write-Host "Creating startup task..."
schtasks /Create /TN "RemoteCameraAgent" /TR $action /SC ONSTART /RL HIGHEST /F

Write-Host "Done."