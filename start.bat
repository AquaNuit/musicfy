@echo off
title Musicfy
cd /d "%~dp0"

echo ============================================
echo   Musicfy - starting local server...
echo ============================================
echo.

where python >nul 2>nul
if %errorlevel%==0 (
    start "Musicfy Server" /min python -m http.server 8080
    goto open
)

where py >nul 2>nul
if %errorlevel%==0 (
    start "Musicfy Server" /min py -m http.server 8080
    goto open
)

where node >nul 2>nul
if %errorlevel%==0 (
    start "Musicfy Server" /min npx --yes serve . -l 8080
    goto open
)

echo Neither Python nor Node.js was found on this PC.
echo Please install Python from https://www.python.org/downloads/
echo and tick "Add Python to PATH" during setup, then run start.bat again.
echo.
pause
exit /b 1

:open
timeout /t 2 /nobreak >nul
start "" http://localhost:8080
echo Musicfy is running at http://localhost:8080
echo Your browser should open automatically. If not, open the address above manually.
echo.
echo To stop Musicfy, close the minimized "Musicfy Server" window in the taskbar.
echo.
pause
