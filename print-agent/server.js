"use strict";

const http = require("http");
const escpos = require("escpos");
escpos.USB = require("escpos-usb");

const PUERTO = 9847;

// Orígenes desde los que se acepta imprimir. Agregá acá cualquier otro dominio/URL
// que uses para abrir la app (por ejemplo si cambia el nombre del proyecto en Vercel).
const ORIGENES_PERMITIDOS = new Set([
  "https://gestion-nexusgestion.vercel.app",
  "http://localhost:3000",
]);

function setCors(req, res) {
  const origin = req.headers.origin;
  if (origin && ORIGENES_PERMITIDOS.has(origin)) {
    res.setHeader("Access-Control-Allow-Origin", origin);
  }
  res.setHeader("Access-Control-Allow-Methods", "POST, GET, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  // Chrome/Edge bloquean por defecto que una página pública (https://...vercel.app) le
  // hable a una IP privada/local (127.0.0.1) - "Private Network Access". Este header en
  // la respuesta al preflight es lo que le confirma al navegador que el pedido es válido.
  if (req.headers["access-control-request-private-network"] === "true") {
    res.setHeader("Access-Control-Allow-Private-Network", "true");
  }
}

function imprimir(contenido) {
  return new Promise((resolve, reject) => {
    let device;
    try {
      device = new escpos.USB();
    } catch (err) {
      reject(new Error(`No se encontró la impresora USB: ${err.message}`));
      return;
    }
    const printer = new escpos.Printer(device);
    device.open((err) => {
      if (err) {
        reject(err);
        return;
      }
      printer.font("a").style("normal").size(0, 0).text(contenido).cut();
      printer.close(() => resolve());
    });
  });
}

const server = http.createServer((req, res) => {
  setCors(req, res);

  if (req.method === "OPTIONS") {
    res.writeHead(204);
    res.end();
    return;
  }

  if (req.method === "GET" && req.url === "/health") {
    res.writeHead(200, { "Content-Type": "text/plain" });
    res.end("ok");
    return;
  }

  if (req.method === "POST" && req.url === "/imprimir") {
    let body = "";
    req.on("data", (chunk) => {
      body += chunk;
    });
    req.on("end", async () => {
      try {
        const { contenido } = JSON.parse(body || "{}");
        if (!contenido) {
          res.writeHead(400, { "Content-Type": "application/json" });
          res.end(JSON.stringify({ error: "Falta contenido" }));
          return;
        }
        await imprimir(contenido);
        res.writeHead(200, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ success: true }));
      } catch (err) {
        console.error("Error al imprimir:", err);
        res.writeHead(500, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ error: String((err && err.message) || err) }));
      }
    });
    return;
  }

  res.writeHead(404);
  res.end();
});

server.listen(PUERTO, "127.0.0.1", () => {
  console.log(`Agente de impresión escuchando en http://127.0.0.1:${PUERTO}`);
});
