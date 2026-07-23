# Agente de impresión local (PowerShell, sin instalar nada)

Corre en la PC de la caja y escucha en `http://127.0.0.1:9847`. La app web (Chrome o
Edge, usados de forma normal, sin flags) le pide imprimir por esa dirección; el agente
manda el ticket directo a la impresora usando el driver de Windows que ya tenés
instalado, en modo RAW (sin pasar por el diálogo de impresión ni por ningún visor).

No hace falta instalar Node, ni reemplazar el driver de la impresora: usa PowerShell,
que ya viene con Windows (7/8/10/11), y manda los datos a través del spooler normal de
Windows con el mismo driver que la impresora ya tiene.

Si el agente no está corriendo (o falla), la app muestra un error y no imprime. Nunca abre
el diálogo de impresión del navegador, para evitar que la caja quede esperando una
confirmación manual.

## Instalación rápida para EPSON TM-T20II

En la PC que tiene conectada la impresora, hacer doble clic en
`INSTALAR-EPSON-TM-T20II.cmd`. El instalador detecta el nombre configurado en Windows,
descarga y configura el agente, lo inicia y lo deja preparado para arrancar
automáticamente al iniciar sesión. No hace falta editar ningún archivo.

## Configuración (una sola vez)

1. Copiar esta carpeta `print-agent` a la PC de la caja (por ejemplo a `C:\print-agent`).
2. Averiguar el nombre EXACTO de la impresora en Windows: abrir PowerShell y correr
   ```
   Get-Printer
   ```
   (o ir a Configuración → Bluetooth y dispositivos → Impresoras y escáneres). Copiar el
   nombre tal cual aparece.
3. Editar `agente-impresion.ps1` con el Bloc de notas y reemplazar esta línea:
   ```
   $PrinterName = "NOMBRE_DE_TU_IMPRESORA"
   ```
   por el nombre real, por ejemplo `$PrinterName = "POS-58"`.

## Probarlo

1. Click derecho sobre `agente-impresion.ps1` → **Ejecutar con PowerShell**.
   - Si Windows bloquea la ejecución de scripts, abrir PowerShell como administrador una
     vez y correr: `Set-ExecutionPolicy RemoteSigned` (elegir "S" cuando pregunte).
2. Tiene que quedar una ventana abierta diciendo "Agente de impresión escuchando en
   http://127.0.0.1:9847". Dejarla así (no cerrarla) mientras probás.
3. En el navegador, entrar a `http://127.0.0.1:9847/health` → tiene que responder `ok`.
4. Desde la app, imprimir un ticket normalmente: debería salir directo por la impresora
   sin ningún diálogo. Si algo falla, el motivo aparece en esa ventana de PowerShell y
   también en la consola del navegador (F12 → Console).

## Que arranque solo con Windows (sin dejar ninguna ventana abierta)

1. `Win + R` → escribir `shell:startup` → Enter (abre la carpeta de Inicio).
2. Crear ahí un acceso directo que apunte al archivo `iniciar-oculto.vbs` de esta carpeta.
3. Reiniciar la PC una vez para confirmar que arranca solo (entrando de nuevo a
   `http://127.0.0.1:9847/health`). Esta vez no va a aparecer ninguna ventana: corre
   invisible en segundo plano.

## Si los acentos/eñes salen mal en el ticket

Dentro de `agente-impresion.ps1` buscar esta línea:
```
$codepage = [System.Text.Encoding]::GetEncoding(437)
```
y probar cambiando `437` por `850` (las dos tablas de caracteres más comunes en
impresoras térmicas ESC/POS). Guardar y reiniciar el agente.

## Si cambia la URL de la app en Vercel

Editar `agente-impresion.ps1`, la línea `$OrigenesPermitidos`, y agregar/actualizar la
URL. Sin esto, el navegador bloquea el pedido por CORS y la app muestra un error de
impresión.
