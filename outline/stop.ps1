$ErrorActionPreference = "Stop"

$ScriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path

if (-not (Get-Command docker -ErrorAction SilentlyContinue)) {
  throw "Docker is not installed or not available in PATH."
}

Push-Location $ScriptDir
try {
  docker compose down
} finally {
  Pop-Location
}

Write-Host "Outline stopped."
