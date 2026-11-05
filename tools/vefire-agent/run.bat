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
python -m pip install -r requirements.txt
echo.
echo After start open the remote URL from the console on your phone.
echo Lid closed: Win+P = Second screen only; Power = Do nothing when lid closes.
echo.
python agent.py
pause
