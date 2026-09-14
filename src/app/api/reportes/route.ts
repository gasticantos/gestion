import { NextRequest, NextResponse } from "next/server";
import { consultarReporte } from "@/lib/consultaReportes";
import { sesionActual } from "@/lib/sesionServidor";

export async function GET(req: NextRequest) {
  const sesion = await sesionActual();
  if (!sesion) return NextResponse.json({ error: "No autenticado" }, { status: 401 });
  const reporte = await consultarReporte(new URL(req.url).searchParams, sesion.negocioId);
  if (!reporte) return NextResponse.json({ error: "Período inválido" }, { status: 400 });
  return NextResponse.json(reporte, { headers: { "Cache-Control": "no-store" } });
}
