@echo off
cd /d "%~dp0"
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
python -m pip install -U -r requirements.txt
echo.
echo Lid closed: Win+P = Second screen only; Power = Do nothing when lid closes.
echo Remote is inside Vmeste -^> Vefire -^> Pult (no separate link needed).
echo.
python agent.py
pause
