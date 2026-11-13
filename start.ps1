Write-Host "======================================================================" -ForegroundColor Cyan
Write-Host "   VPARK - Bengaluru Smart Parking Platform" -ForegroundColor White
Write-Host "   Yelahanka Pilot Micro-Market" -ForegroundColor White
Write-Host "======================================================================" -ForegroundColor Cyan
Write-Host ""

if (-not (Get-Command node -ErrorAction SilentlyContinue)) {
    Write-Host "[ERROR] Node.js is not found in PATH. Please install Node.js (v18+)." -ForegroundColor Red
    Pause
    Exit 1
}

Set-Location -Path $PSScriptRoot

if (-not (Test-Path "node_modules")) {
    Write-Host "[1/2] Installing dependencies..." -ForegroundColor Yellow
    npm.cmd install
}

Write-Host "[2/2] Starting VPark development server on http://localhost:3000 ..." -ForegroundColor Green
Write-Host "Opening browser..." -ForegroundColor Yellow
Start-Process "http://localhost:3000"

npm.cmd run dev

