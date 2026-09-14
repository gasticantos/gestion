import { prisma } from "@/lib/prisma";

export type TransaccionCaja = Parameters<Parameters<typeof prisma.$transaction>[0]>[0];

/** Ventas cobradas que todavía no forman parte de un cierre, sin corte horario. */
export function ventasPendientesCaja(negocioId: number) {
  return { negocioId, estado: "CERRADA" as const, cierreCajaAt: null };
}

/** El límite es un cierre efectivamente realizado, nunca el cambio de día. */
export async function filtroVentasCajaActual(negocioId: number, cliente: Pick<TransaccionCaja, "controlCaja"> = prisma) {
  const anterior = await cliente.controlCaja.findFirst({
    where: { negocioId, cerradoAt: { not: null } },
    orderBy: { cerradoAt: "desc" },
    select: { cerradoAt: true },
  });
  return {
    ...ventasPendientesCaja(negocioId),
    ...(anterior?.cerradoAt ? { closedAt: { gte: anterior.cerradoAt } } : {}),
  };
}

/** Apertura, arqueo y cierre de un mismo negocio se procesan de a uno. */
export async function conBloqueoCaja<T>(negocioId: number, operacion: (tx: TransaccionCaja) => Promise<T>) {
  for (let intento = 0; ; intento++) {
    try {
      return await prisma.$transaction(async (tx) => {
        await tx.$queryRaw`SELECT 1 AS bloqueado FROM pg_advisory_xact_lock(73191, ${negocioId}::integer)`;
        return operacion(tx);
      }, { isolationLevel: "Serializable", maxWait: 5000, timeout: 15000 });
    } catch (error) {
      if (intento < 2 && typeof error === "object" && error && "code" in error && error.code === "P2034") continue;
      throw error;
    }
  }
}
