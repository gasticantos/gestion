import "dotenv/config";
import { Pool } from "pg";
import fs from "node:fs";

const pool = new Pool({ connectionString: process.env.DATABASE_URL, max: 3 });

type Backup = Record<string, Record<string, unknown>[]>;

type Paso = { tabla: string; nombre: string; fechaCampos: string[] };

const pasos: Paso[] = [
  { tabla: "Categoria", nombre: "categoria", fechaCampos: ["createdAt"] },
  { tabla: "Proveedor", nombre: "proveedor", fechaCampos: ["createdAt"] },
  { tabla: "Usuario", nombre: "usuario", fechaCampos: ["createdAt"] },
  { tabla: "Configuracion", nombre: "configuracion", fechaCampos: [] },
  { tabla: "Mesa", nombre: "mesa", fechaCampos: [] },
  { tabla: "Cliente", nombre: "cliente", fechaCampos: ["createdAt"] },
  { tabla: "Producto", nombre: "producto", fechaCampos: ["createdAt", "updatedAt"] },
  { tabla: "StockEntry", nombre: "stockEntry", fechaCampos: ["createdAt"] },
  { tabla: "StockEntryItem", nombre: "stockEntryItem", fechaCampos: [] },
  { tabla: "Reserva", nombre: "reserva", fechaCampos: ["fecha", "createdAt"] },
  { tabla: "Venta", nombre: "venta", fechaCampos: ["createdAt", "closedAt"] },
  { tabla: "Pedido", nombre: "pedido", fechaCampos: ["createdAt"] },
  { tabla: "PedidoItem", nombre: "pedidoItem", fechaCampos: [] },
  { tabla: "Pago", nombre: "pago", fechaCampos: ["createdAt"] },
  { tabla: "MovimientoCuentaCorriente", nombre: "movimientoCuentaCorriente", fechaCampos: ["createdAt"] },
];

function valorSql(v: unknown): unknown {
  if (v === null || v === undefined) return null;
  return v;
}

async function main() {
  const raw = fs.readFileSync("./scripts/backup-datos.json", "utf-8");
  const data: Backup = JSON.parse(raw);

  for (const paso of pasos) {
    const filas = data[paso.nombre] ?? [];
    if (filas.length === 0) {
      console.log(paso.nombre, "-> 0 filas, se omite");
      continue;
    }

    const columnas = Object.keys(filas[0]);
    let importadas = 0;

    for (const fila of filas) {
      const valores = columnas.map((c) => valorSql(fila[c]));
      const placeholders = columnas.map((_, i) => `$${i + 1}`).join(", ");
      const columnasSql = columnas.map((c) => `"${c}"`).join(", ");
      const actualizaciones = columnas
        .filter((c) => c !== "id")
        .map((c) => `"${c}" = EXCLUDED."${c}"`)
        .join(", ");

      const sql = `
        INSERT INTO "${paso.tabla}" (${columnasSql}) VALUES (${placeholders})
        ON CONFLICT (id) DO UPDATE SET ${actualizaciones}
      `;

      await pool.query(sql, valores);
      importadas++;
    }

    await pool.query(
      `SELECT setval(pg_get_serial_sequence('"${paso.tabla}"', 'id'), COALESCE((SELECT MAX(id) FROM "${paso.tabla}"), 1))`
    );
    console.log(paso.nombre, "->", importadas, "filas importadas");
  }

  console.log("\nImportación completa.");
  await pool.end();
}

main().catch(async (e) => {
  console.error(e);
  await pool.end();
  process.exit(1);
});
