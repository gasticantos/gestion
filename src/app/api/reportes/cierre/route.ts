import { NextRequest, NextResponse } from "next/server";
import { cerrarJornadaCaja } from "@/lib/cierreCaja";
import { formatearMoneda } from "@/lib/formato";
import { sesionActual } from "@/lib/sesionServidor";
import { obtenerUsuarioIdDesdeRequest, registrarAuditoria } from "@/lib/auditoria";

export async function POST(req: NextRequest) {
  const sesion = await sesionActual();
  if (!sesion || sesion.rol === "MOZO") {
    return NextResponse.json({ error: "No tenés permiso para cerrar la caja" }, { status: 403 });
  }

  const body = await req.json().catch(() => ({}));
  const controlCajaId = Number(body.controlCajaId);
  if (!Number.isInteger(controlCajaId) || controlCajaId <= 0) {
    return NextResponse.json({ error: "Abrí Control de caja para cerrar el turno activo" }, { status: 400 });
  }
  const resultado = await cerrarJornadaCaja({
    negocioId: sesion.negocioId, controlCajaId,
    operador: { nombre: sesion.nombre, rol: sesion.rol },
  });

  if (resultado.estado === "YA_CERRADO") {
    return NextResponse.json({ error: "La caja de esta jornada ya fue cerrada" }, { status: 409 });
  }
  if (resultado.estado === "CAJA_NO_ABIERTA") {
    return NextResponse.json({ error: "La caja indicada no existe" }, { status: 409 });
  }
  if (resultado.estado === "ARQUEO_PENDIENTE") {
    return NextResponse.json(
      { error: "Antes de cerrar, completá el arqueo y el efectivo inicial de la próxima caja" },
      { status: 409 }
    );
  }
  if (resultado.estado === "MESAS_ABIERTAS") {
    return NextResponse.json(
      {
        error: `No se puede cerrar la caja. Hay ${resultado.mesasAbiertas.length} mesa(s) con saldo abierto: ${resultado.mesasAbiertas.join(", ")}`,
        mesasAbiertas: resultado.mesasAbiertas,
      },
      { status: 409 }
    );
  }
  const usuarioId = await obtenerUsuarioIdDesdeRequest(req);
  await registrarAuditoria(
    usuarioId,
    "cerrar_caja",
    `Cierre de caja ${resultado.codigo} - ${resultado.cantidadVentas} ventas - Total $${formatearMoneda(resultado.total)}`
  );
  return NextResponse.json({ success: true, ...resultado });
}
