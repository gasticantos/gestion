import { PrismaClient } from "@/generated/prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { Pool } from "pg";
import { cookies } from "next/headers";
import { COOKIE_SESION, verificarSesion } from "@/lib/session";

const globalForPrisma = globalThis as unknown as {
  prisma: ReturnType<typeof crearPrisma> | undefined;
  pgPool: Pool | undefined;
};

// max bajo a propósito: en serverless (Vercel) cada instancia abre su propio pool, así que hay
// que dejar margen para muchas instancias concurrentes sin agotar el límite de Postgres/pooler.
const pool = globalForPrisma.pgPool ?? new Pool({ connectionString: process.env.DATABASE_URL, max: 5 });
const adapter = new PrismaPg(pool);

const MODELOS_NEGOCIO = new Set([
  "Categoria", "Usuario", "Configuracion", "ImpresionTrabajo", "AuditoriaLog",
  "Proveedor", "Producto", "StockEntry", "Mesa", "Reserva", "Venta", "Cliente",
]);
const FILTROS_RELACIONALES: Record<string, (negocioId: number) => object> = {
  StockEntryItem: (negocioId) => ({ stockEntry: { negocioId } }),
  Pedido: (negocioId) => ({ venta: { negocioId } }),
  PedidoItem: (negocioId) => ({ pedido: { venta: { negocioId } } }),
  Pago: (negocioId) => ({ venta: { negocioId } }),
  MovimientoCuentaCorriente: (negocioId) => ({ cliente: { negocioId } }),
};

function crearPrisma() {
  return new PrismaClient({ adapter }).$extends({
    query: {
      $allModels: {
        async $allOperations({ model, operation, args, query }) {
          if (!MODELOS_NEGOCIO.has(model) && !FILTROS_RELACIONALES[model]) return query(args);
          const token = (await cookies()).get(COOKIE_SESION)?.value;
          const sesion = token ? await verificarSesion(token) : null;
          if (!sesion?.negocioId) return query(args);

          const entrada = args as Record<string, unknown>;
          const filtro = MODELOS_NEGOCIO.has(model)
            ? { negocioId: sesion.negocioId }
            : FILTROS_RELACIONALES[model](sesion.negocioId);
          if (operation === "create" && MODELOS_NEGOCIO.has(model)) {
            entrada.data = { ...(entrada.data as object), negocioId: sesion.negocioId };
          } else if (operation === "createMany" && MODELOS_NEGOCIO.has(model)) {
            const datos = Array.isArray(entrada.data) ? entrada.data : [entrada.data];
            entrada.data = datos.map((dato) => ({ ...(dato as object), negocioId: sesion.negocioId }));
          } else if (operation === "upsert" && MODELOS_NEGOCIO.has(model)) {
            entrada.where = { ...(entrada.where as object), ...filtro };
            entrada.create = { ...(entrada.create as object), negocioId: sesion.negocioId };
          } else if (operation !== "create" && operation !== "createMany") {
            entrada.where = { ...(entrada.where as object), ...filtro };
          }
          return query(args);
        },
      },
    },
  });
}

export const prisma = globalForPrisma.prisma ?? crearPrisma();

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prisma;
  globalForPrisma.pgPool = pool;
}
