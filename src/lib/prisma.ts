import { PrismaClient } from "@/generated/prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { Pool } from "pg";

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
  pgPool: Pool | undefined;
};

// max bajo a propósito: en serverless (Vercel) cada instancia abre su propio pool, así que hay
// que dejar margen para muchas instancias concurrentes sin agotar el límite de Postgres/pooler.
const pool = globalForPrisma.pgPool ?? new Pool({ connectionString: process.env.DATABASE_URL, max: 5 });
const adapter = new PrismaPg(pool);

export const prisma = globalForPrisma.prisma ?? new PrismaClient({ adapter });

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prisma;
  globalForPrisma.pgPool = pool;
}
