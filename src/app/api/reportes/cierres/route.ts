import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { sesionActual } from "@/lib/sesionServidor";
import { interpretarCierre } from "@/lib/historialCierres";

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
  return NextResponse.json(trabajos.map(interpretarCierre));
}
