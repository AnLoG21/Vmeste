@echo off
setlocal EnableExtensions
cd /d "%~dp0"
title Vefire TV Agent - KEEP THIS WINDOW

REM Local VPN/proxy often breaks pip + Edge when down.
set "HTTP_PROXY="
set "HTTPS_PROXY="
set "http_proxy="
set "https_proxy="
set "ALL_PROXY="
set "all_proxy="
set "NO_PROXY=*"
set "no_proxy=*"
set "PYTHONIOENCODING=utf-8"
set "PYTHONUTF8=1"
chcp 65001 >nul 2>&1

echo ========================================
echo   Vefire TV Agent
echo   %CD%
echo ========================================
echo.
echo IMPORTANT: do not close this window.
echo If Edge goes fullscreen, press Alt+Tab
echo and choose "Vefire TV Agent".
echo.

where python >nul 2>&1
if errorlevel 1 (
  echo [ERROR] Python not in PATH. Install Python and tick Add to PATH.
  goto :end
)

if not exist .env (
  if exist .env.example copy /y .env.example .env >nul
  echo [ERROR] Create .env with VEFIRE_PASSWORD=...
  notepad .env
  goto :end
)

findstr /r /c:"^VEFIRE_PASSWORD=." .env >nul 2>&1
if errorlevel 1 (
  echo [ERROR] VEFIRE_PASSWORD empty in .env
  notepad .env
  goto :end
)

if not exist agent.py (
  echo [ERROR] agent.py missing — copy the whole folder.
  goto :end
)

python -m pip uninstall -y websocket >nul 2>&1
python -c "import dotenv,requests,websocket" >nul 2>&1
if errorlevel 1 (
  echo Installing packages...
  python -m pip install --proxy="" --trusted-host pypi.org --trusted-host files.pythonhosted.org -U -r requirements.txt
  if errorlevel 1 (
    echo [ERROR] pip failed
    goto :end
  )
)

echo Dependencies OK. Starting agent...
echo Log also written to agent-run.log
echo.

:loop
echo ----- start %DATE% %TIME% -----
REM Show output in THIS window and append to log (so window is not "empty").
powershell -NoProfile -ExecutionPolicy Bypass -Command ^
  "$ErrorActionPreference='Continue'; python -u agent.py 2>&1 | Tee-Object -FilePath 'agent-run.log' -Append; exit $LASTEXITCODE"
set "EC=%ERRORLEVEL%"
echo.
echo [WARN] agent stopped code=%EC% at %TIME%
echo Restart in 5 sec. Ctrl+C to quit.
timeout /t 5 /nobreak >nul
goto :loop

:end
echo.
echo ----- stopped -----
echo If this closed by itself before, use START.bat next time.
pause
endlocal
