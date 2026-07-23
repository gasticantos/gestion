' Lanza el agente de impresión (PowerShell) sin mostrar ninguna ventana.
' Pensado para colocarse en la carpeta de Inicio de Windows (shell:startup)
' así el agente arranca solo, en segundo plano, cada vez que se prende la PC.
Set objShell = CreateObject("WScript.Shell")
carpeta = Left(WScript.ScriptFullName, InStrRev(WScript.ScriptFullName, "\"))
comando = "powershell -NoProfile -ExecutionPolicy Bypass -WindowStyle Hidden -File """ & carpeta & "agente-impresion.ps1"""
objShell.Run comando, 0, False
