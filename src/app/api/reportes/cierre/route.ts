import { NextRequest, NextResponse } from "next/server";
import { cerrarJornadaCaja } from "@/lib/cierreCaja";
import { formatearMoneda, limitesJornadaArgentina } from "@/lib/formato";
import { sesionActual } from "@/lib/sesionServidor";
import { obtenerUsuarioIdDesdeRequest, registrarAuditoria } from "@/lib/auditoria";

export async function POST(req: NextRequest) {
  const sesion = await sesionActual();
  if (!sesion || sesion.rol === "MOZO") {
    return NextResponse.json({ error: "No tenés permiso para cerrar la caja" }, { status: 403 });
  }

  const { fecha, desde, hasta } = limitesJornadaArgentina();
  const resultado = await cerrarJornadaCaja({
    negocioId: sesion.negocioId,
    fecha,
    desde,
    hasta,
    operador: { nombre: sesion.nombre, rol: sesion.rol },
  });

  if (resultado.estado === "YA_CERRADO") {
    return NextResponse.json({ error: "La caja de esta jornada ya fue cerrada" }, { status: 409 });
  }
  if (resultado.estado === "SIN_VENTAS") {
    return NextResponse.json({ error: "No hay ventas nuevas para cerrar" }, { status: 409 });
  }
  if (resultado.estado === "MESAS_ABIERTAS") {
    return NextResponse.json(
      {
        error: `No se puede cerrar la caja. Hay ${resultado.mesasAbiertas.length} mesa(s) abierta(s): ${resultado.mesasAbiertas.join(", ")}`,
        mesasAbiertas: resultado.mesasAbiertas,
      },
      { status: 409 }
    );
  }

  const usuarioId = await obtenerUsuarioIdDesdeRequest(req);
  await registrarAuditoria(
    usuarioId,
    "cerrar_caja",
    `Cierre ${fecha} - ${resultado.cantidadVentas} ventas - Total $${formatearMoneda(resultado.total)}`
  );
  return NextResponse.json({ success: true, fecha, ...resultado });
}
