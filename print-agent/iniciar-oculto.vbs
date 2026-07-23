' Lanza el agente de impresión sin mostrar ninguna ventana de consola.
' Pensado para colocarse en la carpeta de Inicio de Windows (shell:startup)
' así el agente arranca solo, en segundo plano, cada vez que se prende la PC.
Set objShell = CreateObject("WScript.Shell")
carpeta = Left(WScript.ScriptFullName, InStrRev(WScript.ScriptFullName, "\"))
objShell.CurrentDirectory = carpeta
objShell.Run "cmd /c npm start", 0, False
