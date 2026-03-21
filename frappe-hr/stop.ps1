$ErrorActionPreference = "Stop"

$ScriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$DockerDir = Join-Path (Join-Path $ScriptDir "hrms-src") "docker"

if (-not (Test-Path $DockerDir)) {
  throw "Missing $DockerDir. Run .\\start.ps1 first."
}

Push-Location $DockerDir
try {
  docker compose down
} finally {
  Pop-Location
}

Write-Host "Frappe HR stopped."
