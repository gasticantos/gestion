import { NextRequest, NextResponse } from "next/server";
import { cerrarJornadaCaja } from "@/lib/cierreCaja";
import { fechaArgentinaYMD, formatearMoneda, limitesJornadaArgentina } from "@/lib/formato";
import { sesionActual } from "@/lib/sesionServidor";
import { obtenerUsuarioIdDesdeRequest, registrarAuditoria } from "@/lib/auditoria";
import { prisma } from "@/lib/prisma";

export async function POST(req: NextRequest) {
  const sesion = await sesionActual();
  if (!sesion || sesion.rol === "MOZO") {
    return NextResponse.json({ error: "No tenés permiso para cerrar la caja" }, { status: 403 });
  }

  const body = await req.json().catch(() => ({}));
  const actual = limitesJornadaArgentina();
  const anterior = {
    desde: new Date(actual.desde.getTime() - 24 * 60 * 60 * 1000),
    hasta: new Date(actual.desde.getTime() - 1),
  };
  const ventaAnteriorPendiente = await prisma.venta.findFirst({
    where: {
      negocioId: sesion.negocioId,
      estado: "CERRADA",
      createdAt: { gte: anterior.desde, lte: anterior.hasta },
      closedAt: { lt: anterior.hasta },
    },
    select: { id: true },
  });
  // Si el automático de las 07:00 quedó bloqueado, el cierre manual normal retoma
  // primero esa jornada. Así Ventas, ticket, PDF y archivo avanzan juntos.
  const recuperarAnterior = body?.recuperarAnterior === true || Boolean(ventaAnteriorPendiente);
  const desde = recuperarAnterior
    ? anterior.desde
    : actual.desde;
  const hasta = recuperarAnterior
    ? anterior.hasta
    : actual.hasta;
  const fecha = recuperarAnterior ? fechaArgentinaYMD(desde) : actual.fecha;
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
    `Cierre ${fecha} - ${resultado.cantidadVentas} ventas - Total $${formatearMoneda(resultado.total)}`
  );
  return NextResponse.json({ success: true, fecha, ...resultado });
}
