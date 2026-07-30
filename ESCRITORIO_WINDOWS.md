# Gestión para Windows

La aplicación de escritorio abre el mismo sistema publicado que usan teléfonos y
tablets, pero además actúa como estación central de impresión.

## Funcionamiento

- Teléfonos, tablets y la caja comparten la misma base de datos.
- Cada ticket o comanda se agrega a una cola en la nube.
- La aplicación Windows consulta esa cola mientras permanece abierta.
- Al encontrar un trabajo, lo envía directamente a la impresora elegida.
- La aplicación incluye e inicia el agente de impresión automáticamente.

## Instalar

1. Descargar el instalador de Gestión para Windows.
2. Ejecutar el archivo `Gestion_..._setup.exe`.
3. Abrir Gestión, iniciar sesión y entrar a **Configuración**.
4. Elegir la impresora y usar **Imprimir prueba**.

La aplicación debe permanecer abierta en la computadora de caja para imprimir trabajos
creados desde teléfonos o tablets.

## Desarrollo

La aplicación requiere Rust y los prerrequisitos de Tauri para Windows.

```bash
npm install
npm run dev
npm run desktop:dev
```

Para generar el instalador NSIS:

```bash
npm run desktop:build
```
