@echo off
cd /d "%~dp0"
if not exist .env (
  echo Copy .env.example to .env and set password first.
  copy .env.example .env >nul
  notepad .env
)
python -m pip install -r requirements.txt
python agent.py
pause
