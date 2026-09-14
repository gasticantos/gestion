import { NextRequest, NextResponse } from "next/server";
import { obtenerUsuarioIdDesdeRequest, registrarAuditoria } from "@/lib/auditoria";
import { codigoCierre } from "@/lib/codigoCierre";
import { formatearMoneda } from "@/lib/formato";
import { obtenerTrabajoCierre } from "@/lib/historialCierres";
import { notificarNuevaImpresion } from "@/lib/notificarImpresion";
import { prisma } from "@/lib/prisma";
import { sesionActual } from "@/lib/sesionServidor";

export async function POST(req: NextRequest, { params }: RouteContext<"/api/reportes/cierres/[id]/reimprimir">) {
  const sesion = await sesionActual();
  if (!sesion || sesion.rol === "MOZO") {
    return NextResponse.json({ error: "No tenés permiso para reimprimir cierres" }, { status: 403 });
  }

  const { id: idTexto } = await params;
  const id = Number(idTexto);
  if (!Number.isInteger(id) || id <= 0) {
    return NextResponse.json({ error: "Cierre inválido" }, { status: 400 });
  }

  const original = await prisma.impresionTrabajo.findFirst({
    where: {
      id,
      negocioId: sesion.negocioId,
      referencia: { startsWith: "cierre-caja:" },
    },
    select: { contenido: true, referencia: true },
  });
  if (!original) {
    return NextResponse.json({ error: "Cierre no encontrado" }, { status: 404 });
  }

  const fecha = original.referencia?.match(/^cierre-caja:(\d{4}-\d{2}-\d{2})/)?.[1] || "";
  const controlCajaId = Number(original.referencia?.match(/:control:(\d+)$/)?.[1] || id);
  const codigo = codigoCierre(fecha, controlCajaId);
  let contenido = original.contenido.includes(codigo)
    ? original.contenido
    : original.contenido.replace(
        "[[SUBTITLE]] CIERRE DE CAJA",
        `[[SUBTITLE]] CIERRE DE CAJA\n[[HR]]\n[[HERO]] ${codigo}\n[[CENTER]] IDENTIFICADOR DEL CIERRE`
      );
  if (!contenido.includes("COBROS DE CUENTA CORRIENTE")) {
    const cierre = await obtenerTrabajoCierre(id, sesion.negocioId);
    if (cierre) {
      const cobros = cierre.cobrosCuentaCorriente;
      const bloque = [
        "[[HR]]",
        "[[SECTION]] COBROS DE CUENTA CORRIENTE",
        `[[ROW]] COBROS REALIZADOS: ${cobros.cantidad}`,
        `[[ROW]] COBROS CC EFECTIVO $${formatearMoneda(cobros.porMetodo.EFECTIVO)}`,
        `[[ROW]] COBROS CC TARJETA $${formatearMoneda(cobros.porMetodo.TARJETA)}`,
        `[[ROW]] COBROS CC TRANSFERENCIA $${formatearMoneda(cobros.porMetodo.TRANSFERENCIA)}`,
        `[[TOTAL]] TOTAL COBRADO CC $${formatearMoneda(cobros.total)}`,
      ].join("\n");
      const antesDeControl = "[[HR]]\n[[SECTION]] CONTROL DE EFECTIVO";
      contenido = contenido.includes(antesDeControl)
        ? contenido.replace(antesDeControl, `${bloque}\n${antesDeControl}`)
        : contenido.replace("[[FOOTER]] Fin del cierre de caja", `${bloque}\n[[HR]]\n[[FOOTER]] Fin del cierre de caja`);
    }
  }

  const trabajo = await prisma.impresionTrabajo.create({
    data: {
      tipo: "TICKET",
      contenido,
      impresora: null,
      negocioId: sesion.negocioId,
    },
    select: { id: true },
  });
  await notificarNuevaImpresion();

  await registrarAuditoria(
    await obtenerUsuarioIdDesdeRequest(req),
    "reimprimir_cierre_caja",
    `Reimpresión de cierre ${codigo}`
  );

  return NextResponse.json({ success: true, trabajoId: trabajo.id, codigo }, { status: 201 });
}
