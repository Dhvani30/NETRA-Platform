@echo off
echo ==============================================================================
echo         NETRA INTELLIGENCE PLATFORM -- SYSTEM LAUNCH SEQUENCE
echo ==============================================================================
cd /d "%~dp0\.."

echo [*] Phase 1: Running Preflight Checks...
python scripts\preflight.py
if %ERRORLEVEL% NEQ 0 (
    echo [!] Preflight checks failed! Resolve errors before launching demo.
    pause
    exit /b %ERRORLEVEL%
)

echo.
echo [*] Phase 2: Launching NETRA Unified Pipeline...
echo Starting Continuous Background Scheduler...
start "NETRA Scheduler" cmd /k "cd backend && python -m app.scheduler"

echo Starting FastAPI Backend Engine on http://localhost:8000...
start "NETRA API" cmd /k "cd backend && python -m uvicorn main:app --reload --port 8000"

echo Starting Vite Frontend on http://localhost:5173...
start "NETRA Frontend" cmd /k "cd frontend && npm run dev"

echo.
echo ==============================================================================
echo   NETRA Platform is active and ready for live demonstration.
echo   - Frontend: http://localhost:5173
echo   - API Docs: http://localhost:8000/docs
echo   - Preflight: PASSED
echo ==============================================================================
