@echo off
rem StudyMap tests on Windows: double-click this file, or run "test.bat core undo" for only some suites.
rem Quick checks of the map maths first (seconds), then the browser suites (about 30 minutes, needs the internet).
setlocal
cd /d "%~dp0"

where node >nul 2>nul
if errorlevel 1 (
  echo Node.js is not installed. Install the LTS version from https://nodejs.org and run this again.
  pause
  exit /b 1
)

if not exist "node_modules\playwright" (
  echo Installing packages, once...
  call npm install
  if errorlevel 1 goto :failed
)
rem the test browser (downloads once, about 150 MB)
call npx playwright install chromium
if errorlevel 1 goto :failed

set RESULT=0
echo.
echo ===== Quick checks =====
call node tests\unit.mjs
if errorlevel 1 set RESULT=1

echo.
echo ===== Browser tests =====
call node tests\run.mjs %*
if errorlevel 1 set RESULT=1

echo.
if "%RESULT%"=="0" (echo ALL TESTS PASSED) else (echo SOME TESTS FAILED - see the FAIL lines above, or tests\out\report.txt)
pause
exit /b %RESULT%

:failed
echo Setup failed. Check your internet connection and run this again.
pause
exit /b 1
