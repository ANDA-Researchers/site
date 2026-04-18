@echo off
setlocal
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0run_jekyll_debug.ps1" %*
