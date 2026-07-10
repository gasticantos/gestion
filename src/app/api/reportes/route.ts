import { NextRequest, NextResponse } from "next/server";
import { obtenerReporteVentas } from "@/lib/reportes";

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const desdeStr = searchParams.get("desde");
  const hastaStr = searchParams.get("hasta");

  if (!desdeStr || !hastaStr) {
    return NextResponse.json({ error: "Faltan los parámetros desde/hasta" }, { status: 400 });
  }

  const desde = new Date(`${desdeStr}T00:00:00`);
  const hasta = new Date(`${hastaStr}T23:59:59.999`);

  if (isNaN(desde.getTime()) || isNaN(hasta.getTime())) {
    return NextResponse.json({ error: "Fechas inválidas" }, { status: 400 });
  }

  const reporte = await obtenerReporteVentas(desde, hasta);
  return NextResponse.json(reporte);
}
