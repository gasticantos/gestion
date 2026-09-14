import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { sesionActual } from "@/lib/sesionServidor";
import { interpretarCierre } from "@/lib/historialCierres";
import { resumirCobrosCuentaCorriente } from "@/lib/reportes";

export async function GET() {
  const sesion = await sesionActual();
  if (!sesion || sesion.rol === "MOZO") {
    return NextResponse.json({ error: "No tenés permiso para consultar cierres" }, { status: 403 });
  }
  const trabajos = await prisma.impresionTrabajo.findMany({
    where: { negocioId: sesion.negocioId, referencia: { startsWith: "cierre-caja:" } },
    select: {
      id: true,
      referencia: true,
      contenido: true,
      estado: true,
      intentos: true,
      createdAt: true,
      printedAt: true,
      error: true,
    },
    orderBy: { createdAt: "desc" },
    take: 200,
  });
  const cierres = trabajos.map(interpretarCierre);
  const controlIds = [...new Set(trabajos.map((trabajo) =>
    Number(trabajo.referencia?.match(/:control:(\d+)$/)?.[1])
  ).filter(Number.isInteger))];
  const controles = controlIds.length
    ? await prisma.controlCaja.findMany({
        where: { negocioId: sesion.negocioId, id: { in: controlIds } },
        select: { id: true, createdAt: true, cerradoAt: true },
      })
    : [];
  const porId = new Map(controles.map((control) => [control.id, control]));
  const primerInicio = controles.reduce<Date | null>(
    (menor, control) => !menor || control.createdAt < menor ? control.createdAt : menor,
    null
  );
  const ultimoFin = controles.reduce<Date | null>((mayor, control) => {
    const fin = control.cerradoAt ?? new Date();
    return !mayor || fin > mayor ? fin : mayor;
  }, null);
  const movimientos = primerInicio && ultimoFin
    ? await prisma.movimientoCuentaCorriente.findMany({
        where: {
          tipo: "PAGO",
          createdAt: { gte: primerInicio, lte: ultimoFin },
          cliente: { negocioId: sesion.negocioId },
        },
        select: { monto: true, metodo: true, createdAt: true },
      })
    : [];
  const enriquecidos = cierres.map((cierre, indice) => {
    const controlId = Number(trabajos[indice].referencia?.match(/:control:(\d+)$/)?.[1]);
    const control = porId.get(controlId);
    if (!control) return cierre;
    const fin = control.cerradoAt ?? trabajos[indice].createdAt;
    return {
      ...cierre,
      cobrosCuentaCorriente: resumirCobrosCuentaCorriente(
        movimientos.filter((movimiento) => movimiento.createdAt >= control.createdAt && movimiento.createdAt <= fin)
      ),
    };
  });
  return NextResponse.json(enriquecidos);
}
