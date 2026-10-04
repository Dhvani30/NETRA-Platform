@echo off
title NETRA Intelligence Platform - Auto Launcher
echo ==========================================
echo   NETRA DEMO MODE: INITIALIZING...
echo   Application Dashboard: http://localhost:5173
echo ==========================================
echo.

cd /d "%~dp0backend\app"
python pipeline.py

pause