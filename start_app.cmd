@echo off

set "REPO_ROOT=%~dp0"

start "AI4ALL Backend" /D "%REPO_ROOT%backend" cmd /k "call start_backend.cmd"

start "AI4ALL Frontend" /D "%REPO_ROOT%energy-chat-dashboard" cmd /k "call start_frontend.cmd"

start "" "http://localhost:5173/"
