@echo off
cd /d "%~dp0"

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

where python >nul 2>&1
if errorlevel 1 (
  echo Install Python 3 from https://www.python.org/downloads/ and tick Add to PATH
  pause
  exit /b 1
)
if not exist .env (
  copy .env.example .env >nul
  echo Fill VEFIRE_PASSWORD in .env
  notepad .env
)

REM Wrong PyPI package "websocket" shadows websocket-client — remove it first.
python -m pip uninstall -y websocket >nul 2>&1

REM Install deps without system proxy; continue even if PyPI is unreachable.
python -c "import dotenv,requests,websocket" >nul 2>&1
if errorlevel 1 (
  echo Installing packages (no proxy)...
  python -m pip install --proxy="" --trusted-host pypi.org --trusted-host files.pythonhosted.org -U -r requirements.txt
  if errorlevel 1 (
    echo WARNING: pip failed. If agent crashes, fix network/proxy and retry.
  )
) else (
  echo Dependencies already installed — skip pip.
)

echo.
echo Lid closed: Win+P = Second screen only; Power = Do nothing when lid closes.
echo Remote is inside Vmeste -^> Vefire -^> Pult (no separate link needed).
echo.
python agent.py
pause
