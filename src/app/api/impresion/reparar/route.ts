const REPARACION = `@echo off
title Reparar impresion de Gestion
echo Reparando el agente de impresion...
powershell.exe -NoProfile -ExecutionPolicy Bypass -Command "$ErrorActionPreference='SilentlyContinue'; $gestion=Get-Process | Where-Object { $_.ProcessName -like '*gestion*' } | Select-Object -First 1; $ruta=$gestion.Path; $duenos=Get-NetTCPConnection -LocalPort 9850 -State Listen | Select-Object -ExpandProperty OwningProcess -Unique; foreach($dueno in $duenos){ Stop-Process -Id $dueno -Force }; if($gestion){ Stop-Process -Id $gestion.Id -Force }; Start-Sleep -Seconds 2; if($ruta -and (Test-Path $ruta)){ Start-Process $ruta }"
echo.
echo Reparacion terminada. Si Gestion no se abrio sola, abrila normalmente.
timeout /t 4 /nobreak >nul
`;

export async function GET() {
  return new Response(REPARACION, {
    headers: {
      "Content-Type": "application/octet-stream",
      "Content-Disposition": 'attachment; filename="Reparar-Impresion.cmd"',
      "Cache-Control": "no-store",
      "X-Content-Type-Options": "nosniff",
    },
  });
}
