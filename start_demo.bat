@echo off
title NETRA Intelligence Platform - Auto Launcher
echo ==========================================
echo   NETRA DEMO MODE: INITIALIZING...
echo ==========================================
echo.

cd /d "%~dp0backend\app"
python pipeline.py

pause