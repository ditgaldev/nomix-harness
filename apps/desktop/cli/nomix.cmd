@echo off
setlocal DisableDelayedExpansion
set "ELECTRON_RUN_AS_NODE=1"
"%~dp0..\..\..\..\Nomix Harness.exe" --expose-internals "%~dp0..\..\..\app.asar\nomix\node_modules\@nomix-ai\nomix-desktop-host\lib\cli.js" %*
exit /b %errorlevel%
