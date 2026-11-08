@echo off
rem Montazhshy - Studio (Windows)
chcp 65001 >nul
cd /d "%~dp0"
.venv\Scripts\python -m montazhshy %*
pause
