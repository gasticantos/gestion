import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { sesionActual } from "@/lib/sesionServidor";
import { generarPdfCierreCaja } from "@/lib/pdfCierreCaja";
import { enviarDocumentoTelegram } from "@/lib/telegram";
import { formatearMoneda } from "@/lib/formato";
import { obtenerTrabajoCierre, reporteDesdeCierre } from "@/lib/historialCierres";

async function preparar(idTexto: string) {
  const sesion = await sesionActual();
  if (!sesion || sesion.rol === "MOZO") return { error: "No tenés permiso", status: 403 } as const;
  const id = Number(idTexto);
  if (!Number.isInteger(id)) return { error: "Cierre inválido", status: 400 } as const;
  const cierre = await obtenerTrabajoCierre(id, sesion.negocioId);
  if (!cierre) return { error: "Cierre no encontrado", status: 404 } as const;
  const configuracion = await prisma.configuracion.findUnique({
    where: { negocioId: sesion.negocioId },
    select: { nombrePrograma: true },
  });
  const pdf = generarPdfCierreCaja({
    nombreNegocio: configuracion?.nombrePrograma || "Gestión",
    fechaJornada: cierre.fecha,
    operador: cierre.operador,
    reporte: reporteDesdeCierre(cierre),
    generadoEn: cierre.creadoEn,
  });
  return { cierre, pdf } as const;
}

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const preparado = await preparar(id);
  if ("error" in preparado) return NextResponse.json({ error: preparado.error }, { status: preparado.status });
  return new Response(preparado.pdf, {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `inline; filename="cierre-caja-${preparado.cierre.fecha}.pdf"`,
      "Cache-Control": "no-store",
    },
  });
}

export async function POST(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const preparado = await preparar(id);
  if ("error" in preparado) return NextResponse.json({ error: preparado.error }, { status: preparado.status });
  const envio = await enviarDocumentoTelegram(
    preparado.pdf,
    `cierre-caja-${preparado.cierre.fecha}.pdf`,
    `Reenvío de cierre de caja · ${preparado.cierre.fecha}\n${preparado.cierre.cantidadVentas} ventas · $${formatearMoneda(preparado.cierre.total)}`
  );
  if (!envio.ok) return NextResponse.json({ error: envio.error }, { status: 502 });
  return NextResponse.json({ success: true });
}
