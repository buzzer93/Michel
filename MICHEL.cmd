@echo off
rem Starts Michel if needed and opens the dashboard; the launcher itself runs without a window.
start "" "%WINDIR%\System32\conhost.exe" --headless "%WINDIR%\System32\WindowsPowerShell\v1.0\powershell.exe" -NoProfile -ExecutionPolicy Bypass -File "%~dp0windows\Michel.ps1"
