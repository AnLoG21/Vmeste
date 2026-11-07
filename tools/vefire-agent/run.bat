@echo off
setlocal EnableExtensions
cd /d "%~dp0"
title Vefire TV Agent

REM Local VPN/proxy (127.0.0.1:12334) often breaks pip + Edge when it's down.
set "HTTP_PROXY="
set "HTTPS_PROXY="
set "http_proxy="
set "https_proxy="
set "ALL_PROXY="
set "all_proxy="
set "NO_PROXY=*"
set "no_proxy=*"
REM Avoid UnicodeEncodeError crash on Windows cp1251 consoles.
set "PYTHONIOENCODING=utf-8"
set "PYTHONUTF8=1"
chcp 65001 >nul 2>&1

echo ========================================
echo   Vefire TV Agent
echo   Folder: %CD%
echo   Log:    %CD%\agent-run.log
echo ========================================
echo.

where python >nul 2>&1
if errorlevel 1 (
  echo [ERROR] Python not found in PATH.
  echo Install from https://www.python.org/downloads/
  echo Enable checkbox: "Add python.exe to PATH"
  goto :end
)

if not exist .env (
  if exist .env.example copy /y .env.example .env >nul
  echo [ERROR] File .env was missing — created from example.
  echo Open .env and set VEFIRE_PASSWORD, then run again.
  notepad .env
  goto :end
)

findstr /r /c:"^VEFIRE_PASSWORD=.\+" .env >nul 2>&1
if errorlevel 1 (
  echo [ERROR] VEFIRE_PASSWORD is empty in .env
  echo Fill the password for a.loginov150 and save.
  notepad .env
  goto :end
)

if not exist idle.html (
  echo [ERROR] idle.html missing — copy the full Vefire-TV-Agent folder.
  goto :end
)
if not exist agent.py (
  echo [ERROR] agent.py missing — copy the full Vefire-TV-Agent folder.
  goto :end
)

REM Wrong PyPI package "websocket" shadows websocket-client — remove it first.
python -m pip uninstall -y websocket >nul 2>&1

python -c "import dotenv,requests,websocket" >nul 2>&1
if errorlevel 1 (
  echo Installing packages (no proxy)...
  python -m pip install --proxy="" --trusted-host pypi.org --trusted-host files.pythonhosted.org -U -r requirements.txt
  if errorlevel 1 (
    echo [ERROR] pip install failed. Check internet on this laptop.
    goto :end
  )
) else (
  echo Dependencies OK.
)

echo.
echo Keep this window OPEN. Cast from phone: Vmeste -^> Vefire.
echo Lid: Win+P = Second screen only; Power = Do nothing when lid closes.
echo.
echo If it stops, read agent-run.log in this folder.
echo Press Ctrl+C to stop. Auto-restart on crash is ON.
echo.

:loop
echo ----- start %DATE% %TIME% -----
echo ----- start %DATE% %TIME% ----->> agent-run.log
python -u agent.py 1>> agent-run.log 2>&1
set "EC=%ERRORLEVEL%"
echo.
echo [WARN] agent exited with code %EC% at %TIME%
echo [WARN] agent exited with code %EC% at %TIME%>> agent-run.log
echo Last log lines:
powershell -NoProfile -Command "if (Test-Path 'agent-run.log') { Get-Content 'agent-run.log' -Tail 15 }"
echo.
echo Restarting in 5 seconds... (Ctrl+C to quit)
timeout /t 5 /nobreak >nul
goto :loop

:end
echo.
echo ----- stopped -----
echo Full log: %CD%\agent-run.log
pause
endlocal
