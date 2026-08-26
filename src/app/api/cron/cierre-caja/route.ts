import { NextRequest, NextResponse } from "next/server";
import { cerrarJornadaCaja } from "@/lib/cierreCaja";
import { fechaArgentinaYMD, limitesJornadaArgentina } from "@/lib/formato";
import { prisma } from "@/lib/prisma";

function jornadaTerminada(ahora: Date) {
  const actual = limitesJornadaArgentina(ahora);
  const hasta = new Date(actual.desde.getTime() - 1);
  const desde = new Date(actual.desde.getTime() - 24 * 60 * 60 * 1000);
  // La fecha debe coincidir con la que calcula limitesJornadaArgentina para un cierre
  // manual dentro de esta misma jornada (el inicio, no el final): si no coinciden, el
  // cron no reconoce un cierre manual anterior y la cierra de nuevo por duplicado.
  return { fecha: fechaArgentinaYMD(desde), desde, hasta };
}

export async function GET(req: NextRequest) {
  const secreto = process.env.CRON_SECRET;
  if (!secreto || req.headers.get("authorization") !== `Bearer ${secreto}`) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  // El cron corre a las 07:00 ART; se cierra la jornada que acaba de terminar,
  // no la que empieza en ese instante.
  const jornada = jornadaTerminada(new Date());
  const negocios = await prisma.negocio.findMany({ where: { activo: true }, select: { id: true } });
  const resultados = await Promise.all(
    negocios.map(async (negocio) => ({
      negocioId: negocio.id,
      resultado: await cerrarJornadaCaja({
        negocioId: negocio.id,
        ...jornada,
        operador: { nombre: "Sistema", rol: "CIERRE AUTOMÁTICO" },
      }),
    }))
  );
  return NextResponse.json({ jornada: jornada.fecha, resultados });
}
