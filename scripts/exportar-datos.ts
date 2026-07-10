import { PrismaClient } from "../src/generated/prisma/client";
import { PrismaBetterSqlite3 } from "@prisma/adapter-better-sqlite3";
import fs from "node:fs";

const adapter = new PrismaBetterSqlite3({ url: "file:./dev.db" });
const prisma = new PrismaClient({ adapter });

const tablas: Record<string, () => Promise<unknown>> = {
  categoria: () => prisma.categoria.findMany(),
  proveedor: () => prisma.proveedor.findMany(),
  usuario: () => prisma.usuario.findMany(),
  configuracion: () => prisma.configuracion.findMany(),
  mesa: () => prisma.mesa.findMany(),
  cliente: () => prisma.cliente.findMany(),
  producto: () => prisma.producto.findMany(),
  stockEntry: () => prisma.stockEntry.findMany(),
  stockEntryItem: () => prisma.stockEntryItem.findMany(),
  reserva: () => prisma.reserva.findMany(),
  venta: () => prisma.venta.findMany(),
  pedido: () => prisma.pedido.findMany(),
  pedidoItem: () => prisma.pedidoItem.findMany(),
  pago: () => prisma.pago.findMany(),
  movimientoCuentaCorriente: () => prisma.movimientoCuentaCorriente.findMany(),
};

async function main() {
  const data: Record<string, unknown> = {};
  for (const [nombre, fn] of Object.entries(tablas)) {
    data[nombre] = await fn();
    console.log(nombre, "->", (data[nombre] as unknown[]).length, "filas");
  }

  fs.writeFileSync("./scripts/backup-datos.json", JSON.stringify(data, null, 2));
  console.log("\nExportado a scripts/backup-datos.json");
  await prisma.$disconnect();
}

main();
