param(
  [switch]$Update
)

$ErrorActionPreference = "Stop"

$ScriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$RepoDir = Join-Path $ScriptDir "hrms-src"
$DockerDir = Join-Path $RepoDir "docker"

if (-not (Get-Command git -ErrorAction SilentlyContinue)) {
  throw "Git is not installed or not available in PATH."
}

if (-not (Get-Command docker -ErrorAction SilentlyContinue)) {
  throw "Docker is not installed or not available in PATH."
}

if (-not (Test-Path $RepoDir)) {
  Write-Host "Cloning frappe/hrms..."
  git clone https://github.com/frappe/hrms $RepoDir
} elseif ($Update) {
  Write-Host "Updating hrms-src..."
  git -C $RepoDir pull --ff-only
}

if (-not (Test-Path $DockerDir)) {
  throw "Missing $DockerDir. Upstream repository layout may have changed."
}

Write-Host "Starting Frappe HR docker environment..."
Push-Location $DockerDir
try {
  docker compose up -d
} finally {
  Pop-Location
}

Write-Host "Started."
Write-Host "URL: http://localhost:8000"
Write-Host "Default account: Administrator / admin"
