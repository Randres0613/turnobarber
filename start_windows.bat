@echo off
title TurnoBarber
echo Iniciando TurnoBarber...
echo.
echo Abre en tu navegador:
echo http://localhost:8080/?b=barberia-el-jefe
echo.
python -m http.server 8080
pause
