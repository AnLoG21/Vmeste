@echo off
REM Always keep a console open (even if run.bat hits an error).
cd /d "%~dp0"
start "Vefire TV Agent" cmd /k call "%~dp0run.bat"
