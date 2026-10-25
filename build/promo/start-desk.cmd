@echo off
rem Double-click to open the 1234Tools Promotion Desk. It starts the desk in the
rem background if it is not already running, then opens it in your browser.
rem To start it with Windows: node build\promo\desk.js autostart on
node "%~dp0desk.js" start %*
if errorlevel 1 pause
