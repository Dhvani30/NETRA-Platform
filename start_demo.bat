@echo off
chcp 65001 >nul
set PYTHONUTF8=1
set PYTHONIOENCODING=utf-8
title NETRA Intelligence Platform - Auto Launcher
echo ==========================================
echo   NETRA DEMO MODE: INITIALIZING...
echo ==========================================
echo.

cd /d "%~dp0backend\app"
python pipeline.py

pause