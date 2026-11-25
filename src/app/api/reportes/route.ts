import { NextRequest, NextResponse } from "next/server";
import { consultarReporte } from "@/lib/consultaReportes";
import { sesionActual } from "@/lib/sesionServidor";
import { reporteSoloCaja } from "@/lib/permisos";

export async function GET(req: NextRequest) {
  const sesion = await sesionActual();
  if (!sesion) return NextResponse.json({ error: "No autenticado" }, { status: 401 });
  // El cajero solo puede ver la caja abierta: se ignora cualquier período que pida.
  const params = reporteSoloCaja(sesion.rol) ? new URLSearchParams("modo=caja") : new URL(req.url).searchParams;
  const reporte = await consultarReporte(params, sesion.negocioId);
  if (!reporte) return NextResponse.json({ error: "Período inválido" }, { status: 400 });
  return NextResponse.json(reporte, { headers: { "Cache-Control": "no-store" } });
}
