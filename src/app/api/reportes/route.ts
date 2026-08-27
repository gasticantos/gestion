import { NextRequest, NextResponse } from "next/server";
import { obtenerReporteVentas } from "@/lib/reportes";
import { limitesRangoJornadasArgentina } from "@/lib/formato";

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const desdeStr = searchParams.get("desde");
  const hastaStr = searchParams.get("hasta");

  if (!desdeStr || !hastaStr) {
    return NextResponse.json({ error: "Faltan los parámetros desde/hasta" }, { status: 400 });
  }

  const { desde, hasta } = limitesRangoJornadasArgentina(desdeStr, hastaStr);

  if (isNaN(desde.getTime()) || isNaN(hasta.getTime())) {
    return NextResponse.json({ error: "Fechas inválidas" }, { status: 400 });
  }

  const reporte = await obtenerReporteVentas(desde, hasta, {
    etiquetaDesde: desdeStr,
    etiquetaHasta: hastaStr,
  });
  return NextResponse.json(reporte);
}
