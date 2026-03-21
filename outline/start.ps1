param(
  [switch]$RecreateEnv
)

$ErrorActionPreference = "Stop"

$ScriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$EnvExample = Join-Path $ScriptDir ".env.example"
$EnvFile = Join-Path $ScriptDir ".env"

if (-not (Get-Command docker -ErrorAction SilentlyContinue)) {
  throw "Docker is not installed or not available in PATH."
}

if (-not (Test-Path $EnvExample)) {
  throw "Missing .env.example in $ScriptDir"
}

function New-HexSecret([int]$Bytes = 32) {
  $buffer = New-Object byte[] $Bytes
  [System.Security.Cryptography.RandomNumberGenerator]::Create().GetBytes($buffer)
  ($buffer | ForEach-Object { $_.ToString("x2") }) -join ""
}

if ($RecreateEnv -and (Test-Path $EnvFile)) {
  Remove-Item $EnvFile -Force
}

if (-not (Test-Path $EnvFile)) {
  Copy-Item $EnvExample $EnvFile -Force
  $secret = New-HexSecret
  $utils = New-HexSecret
  (Get-Content $EnvFile) `
    -replace "replace-with-secret-key", $secret `
    -replace "replace-with-utils-secret", $utils |
    Set-Content $EnvFile
  Write-Host "Created .env with generated secrets."
}

Push-Location $ScriptDir
try {
  docker compose up -d
} finally {
  Pop-Location
}

Write-Host "Outline is starting."
Write-Host "URL: http://127.0.0.1:13080"
Write-Host "Register/Login email inbox: http://127.0.0.1:18025"
