@echo off
rem StudyMap on this PC: double-click this file. The app opens in your browser at http://localhost:5173
rem Close this window to stop it.
setlocal
cd /d "%~dp0"

where node >nul 2>nul
if errorlevel 1 (
  echo Node.js is not installed. Install the LTS version from https://nodejs.org and run this again.
  pause
  exit /b 1
)

if not exist "node_modules" (
  echo Installing packages, once...
  call npm install
  if errorlevel 1 (
    echo Install failed. Check your internet connection and run this again.
    pause
    exit /b 1
  )
)

call npm run dev -- --open
pause
