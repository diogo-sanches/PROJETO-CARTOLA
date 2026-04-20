@echo off
title Cartola FC Stats - Dev Server
cd /d "c:\Users\pcp\Documents\CRTL"
echo.
echo  ==========================================
echo   🏆 CARTOLA FC STATS - Iniciando servidor
echo  ==========================================
echo.
start "" "http://localhost:5173" 2>nul
timeout /t 2 /nobreak >nul
call npm run dev
pause
