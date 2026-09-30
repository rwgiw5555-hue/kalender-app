@echo off
title Kalender App
echo Kalender wird gestartet...
set PATH=C:\Program Files\nodejs;%PATH%
cd /d "%~dp0"
start http://127.0.0.1:3000
npm.cmd run dev
pause
