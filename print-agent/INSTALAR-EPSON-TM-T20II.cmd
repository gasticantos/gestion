@echo off
setlocal
title Instalador de impresion automatica
color 1F

echo.
echo ============================================
echo   IMPRESION AUTOMATICA - EPSON TM-T20II
echo ============================================
echo.
echo Configurando la impresora. Espere un momento...
echo.

powershell.exe -NoProfile -ExecutionPolicy Bypass -Command ^
  "$ErrorActionPreference = 'Stop';" ^
  "$printer = Get-CimInstance Win32_Printer | Where-Object { $_.Name -match 'TM.?T20II' } | Select-Object -First 1;" ^
  "if (-not $printer) { throw 'No se encontro una impresora EPSON TM-T20II instalada en Windows.' };" ^
  "$installDir = Join-Path $env:LOCALAPPDATA 'GestionPrintAgent';" ^
  "New-Item -ItemType Directory -Force -Path $installDir | Out-Null;" ^
  "$agentPath = Join-Path $installDir 'agente-impresion.ps1';" ^
  "Invoke-WebRequest -UseBasicParsing 'https://raw.githubusercontent.com/gasticantos/gestion/main/print-agent/agente-impresion.ps1' -OutFile $agentPath;" ^
  "$content = Get-Content -Raw $agentPath;" ^
  "$safeName = $printer.Name -replace [char]34, [string]::Empty;" ^
  "$printerLine = '$PrinterName = ' + [char]34 + $safeName + [char]34;" ^
  "$content = $content -replace '(?m)^\$PrinterName\s*=.*$', $printerLine;" ^
  "Set-Content -Path $agentPath -Value $content -Encoding UTF8;" ^
  "$startup = [Environment]::GetFolderPath('Startup');" ^
  "$shortcutPath = Join-Path $startup 'Impresion automatica Gestion.lnk';" ^
  "$shell = New-Object -ComObject WScript.Shell;" ^
  "$shortcut = $shell.CreateShortcut($shortcutPath);" ^
  "$shortcut.TargetPath = 'powershell.exe';" ^
  "$shortcut.Arguments = '-NoProfile -ExecutionPolicy Bypass -WindowStyle Hidden -File ' + [char]34 + $agentPath + [char]34;" ^
  "$shortcut.WorkingDirectory = $installDir;" ^
  "$shortcut.WindowStyle = 7;" ^
  "$shortcut.Save();" ^
  "Start-Process powershell.exe -WindowStyle Hidden -ArgumentList @('-NoProfile','-ExecutionPolicy','Bypass','-File',([char]34 + $agentPath + [char]34));" ^
  "Start-Sleep -Seconds 2;" ^
  "$health = Invoke-WebRequest -UseBasicParsing 'http://127.0.0.1:9847/health' -TimeoutSec 3;" ^
  "if ($health.Content.Trim() -ne 'ok') { throw 'El agente no respondio correctamente.' };" ^
  "Write-Host ('Impresora detectada: ' + $printer.Name) -ForegroundColor Green"

if errorlevel 1 goto error

echo.
echo ============================================
echo   LISTO - INSTALACION COMPLETADA
echo ============================================
echo.
echo Ya puede cerrar esta ventana.
echo Los tickets se imprimiran automaticamente.
echo.
pause
exit /b 0

:error
echo.
echo ============================================
echo   NO SE PUDO COMPLETAR LA INSTALACION
echo ============================================
echo.
echo Saque una foto de esta ventana y enviela para recibir ayuda.
echo.
pause
exit /b 1
