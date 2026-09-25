@echo off
echo Starting Umang AI...
echo.

echo [1/2] Starting Backend (FastAPI)...
start "Umang Backend" cmd /k "cd /d d:\umang-ai\backend && .\venv\Scripts\activate && uvicorn main:app --reload"

timeout /t 3 /nobreak > nul

echo [2/2] Starting Frontend (React)...
start "Umang Frontend" cmd /k "cd /d d:\umang-ai\frontend && npm run dev"

timeout /t 4 /nobreak > nul

echo Opening browser...
start http://localhost:5173

echo.
echo Umang AI is starting up!
echo    Backend:  http://localhost:8000
echo    Frontend: http://localhost:5173
echo.
pause
