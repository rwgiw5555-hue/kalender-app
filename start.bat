@echo off
title Kalender App
echo Kalender wird gestartet...
set PATH=C:\Program Files\nodejs;%PATH%
cd /d "%~dp0"
start http://localhost:3000
npm.cmd run dev
pause
