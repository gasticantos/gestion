# Agente de impresión local

Corre en la PC de la caja (Windows) y escucha en `http://127.0.0.1:9847`. La app web
(Chrome o Edge, usados de forma normal, sin flags) le pide imprimir por esa dirección;
el agente manda el ticket directo a la impresora USB por ESC/POS. Como no pasa por
`window.print()`, nunca aparece el diálogo de confirmación del navegador.

Si el agente no está corriendo (o la impresora no responde), la app cae automáticamente
al método anterior (diálogo de impresión del navegador) — no rompe nada si todavía no
lo instalaste.

## Instalación (una sola vez)

1. Instalar [Node.js](https://nodejs.org) en la PC de la caja (versión LTS).
2. Copiar esta carpeta `print-agent` a esa PC (por ejemplo a `C:\print-agent`).
3. Abrir una terminal (cmd) en esa carpeta y correr:
   ```
   npm install
   ```
4. **Paso importante en Windows: driver de la impresora.** El paquete que habla con la
   impresora por USB necesita acceso "crudo" al dispositivo, y el driver normal que
   Windows instala para imprimir (el que usa el Panel de Control) no lo permite. Hay que
   reemplazar el driver de la impresora por `WinUSB` usando la herramienta gratuita
   [Zadig](https://zadig.akeo.ie/):
   - Abrir Zadig, activar "Options → List All Devices".
   - Elegir la impresora térmica en el desplegable.
   - Elegir el driver `WinUSB` e instalar/reemplazar.
   - Ojo: después de este paso, esa impresora ya no va a aparecer como impresora normal
     de Windows (no vas a poder imprimir un Word en ella, por ejemplo) — queda dedicada
     a este agente. Si la usás para otra cosa además del ticket, avisame antes de este paso.

## Probar que funciona

Con el agente corriendo (`npm start` en la carpeta), abrir en el navegador:
```
http://127.0.0.1:9847/health
```
Tiene que responder `ok`. Después, desde la app, imprimir un ticket normalmente: debería
salir directo por la impresora sin ningún diálogo.

## Que arranque solo con Windows

1. Presionar `Win + R`, escribir `shell:startup` y Enter (abre la carpeta de Inicio).
2. Crear un acceso directo ahí que apunte al archivo `iniciar-oculto.vbs` de esta carpeta.
3. Reiniciar la PC una vez para confirmar que el agente arranca solo (podés verificarlo
   entrando de nuevo a `http://127.0.0.1:9847/health`).

## Si cambia la URL de la app en Vercel

Editar `server.js`, el set `ORIGENES_PERMITIDOS`, y agregar/actualizar la URL. Sin esto,
el navegador bloquea el pedido por CORS y la app cae al diálogo de impresión de siempre
(no rompe, pero no imprime en silencio).
