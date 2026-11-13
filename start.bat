@echo off
title VPark - Bengaluru Smart Parking
cd /d "%~dp0"

echo ======================================================================
echo    VPARK - Bengaluru Smart Parking Platform
echo    Yelahanka Pilot Micro-Market
echo ======================================================================
echo.

where node >nul 2>nul
if errorlevel 1 (
    echo [ERROR] Node.js was not found in PATH. Please install Node.js v18 or higher.
    pause
    exit /b 1
)

if not exist node_modules (
    echo [1/2] Installing dependencies...
    call npm.cmd install
    if errorlevel 1 (
        echo [ERROR] npm install failed.
        pause
        exit /b 1
    )
)

if exist .next (
    rmdir /s /q .next 2>nul
)

echo [2/2] Starting VPark server on http://localhost:3000 ...
echo.
echo ======================================================================
echo  Local URL: http://localhost:3000
echo  Press Ctrl+C in this window to stop the server anytime.
echo ======================================================================
echo.

rem Launch default browser
start http://localhost:3000

rem Start Next.js development server
call npm.cmd run dev

if errorlevel 1 (
    echo.
    echo Server stopped or encountered an error.
    pause
)
