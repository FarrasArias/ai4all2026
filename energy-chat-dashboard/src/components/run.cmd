@echo off
setlocal EnableExtensions EnableDelayedExpansion

rem Output file name (created in the current folder)
set "OUT=all_files_contents.txt"

rem Base folder (current directory)
set "BASE=%cd%"

rem Start fresh
if exist "%OUT%" del "%OUT%" >nul 2>&1

for /r "%BASE%" %%F in (*) do (
  rem Skip this script and the output file itself
  if /I not "%%~fF"=="%~f0" if /I not "%%~fF"=="%BASE%\%OUT%" (
    rem Compute a path relative to the starting folder
    set "rel=%%~fF"
    set "rel=!rel:%BASE%\=!"

    rem Header line with //relative\path\file.ext
    >>"%OUT%" echo //!rel!

    rem Dump file contents
    type "%%~fF" >>"%OUT%" 2>nul

    rem Blank line between files
    >>"%OUT%" echo.
  )
)

echo Done. Wrote "%OUT%".
endlocal
