import { NextRequest, NextResponse } from "next/server";
import { conBloqueoCaja, filtroVentasCajaActual } from "@/lib/cajaManual";
import { sesionActual } from "@/lib/sesionServidor";
import { obtenerUsuarioIdDesdeRequest, registrarAuditoria } from "@/lib/auditoria";
import { formatearMoneda } from "@/lib/formato";

// Devuelve a su mesa una venta de mesa ya cobrada (ej. se cobró la mesa equivocada).
// Se anulan sus pagos (y el cargo en cuenta corriente si hubo fiado) y los productos
// vuelven a la cuenta de la mesa para cobrarlos bien. El stock no cambia: los productos
// siguen consumidos. Si la mesa ya tiene otra cuenta abierta, los productos se suman a esa.
// Solo ventas del turno actual (no incluidas en un cierre de caja).

class ErrorReabrir extends Error {
  constructor(mensaje: string, public status = 409) {
    super(mensaje);
  }
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const sesion = await sesionActual();
  if (!sesion || sesion.rol === "MOZO") {
    return NextResponse.json({ error: "No tenés permiso para reabrir ventas" }, { status: 403 });
  }
  const { id } = await params;
  const ventaId = Number(id);
  if (!Number.isInteger(ventaId)) {
    return NextResponse.json({ error: "Venta inválida" }, { status: 400 });
  }

  try {
    const resultado = await conBloqueoCaja(sesion.negocioId, async (tx) => {
      const venta = await tx.venta.findFirst({
        where: { ...(await filtroVentasCajaActual(sesion.negocioId, tx)), id: ventaId },
        include: {
          mesa: true,
          pagos: true,
          movimientosCC: true,
          pedidos: { include: { items: true } },
        },
      });
      if (!venta) throw new ErrorReabrir("La venta no existe o ya forma parte de un cierre de caja", 404);
      if (venta.tipo !== "MESA" || !venta.mesa) throw new ErrorReabrir("Solo se pueden volver a la mesa las ventas de mesas");

      // Al cobrar, "total" queda con el descuento aplicado: se recalcula desde los productos.
      const subtotal = Math.round(
        venta.pedidos.flatMap((p) => p.items).reduce((suma, item) => suma + item.subtotal, 0) * 100
      ) / 100;

      const cargoFiado = venta.movimientosCC
        .filter((m) => m.tipo === "CARGO")
        .reduce((suma, m) => suma + m.monto, 0);
      if (venta.clienteId && cargoFiado > 0) {
        await tx.cliente.update({ where: { id: venta.clienteId }, data: { saldo: { decrement: cargoFiado } } });
      }
      await tx.movimientoCuentaCorriente.deleteMany({ where: { ventaId: venta.id } });
      await tx.pago.deleteMany({ where: { ventaId: venta.id } });

      const abierta = await tx.venta.findFirst({
        where: { mesaId: venta.mesa.id, estado: "ABIERTA", negocioId: sesion.negocioId },
        select: { id: true },
      });

      if (abierta) {
        // La mesa ya tiene otra cuenta: se le suman los productos y la venta cobrada desaparece.
        await tx.pedido.updateMany({ where: { ventaId: venta.id }, data: { ventaId: abierta.id } });
        await tx.ajustePreticket.updateMany({ where: { ventaId: venta.id }, data: { ventaId: abierta.id } });
        await tx.venta.update({ where: { id: abierta.id }, data: { total: { increment: subtotal } } });
        await tx.venta.delete({ where: { id: venta.id } });
      } else {
        await tx.venta.update({
          where: { id: venta.id },
          data: {
            estado: "ABIERTA",
            closedAt: null,
            total: subtotal,
            clienteId: null,
            descuentoPct: 0,
            descuentoResponsable: null,
            propina: 0,
          },
        });
      }
      await tx.mesa.update({ where: { id: venta.mesa.id }, data: { estado: "OCUPADA" } });

      return { venta, mesa: venta.mesa, subtotal, unida: Boolean(abierta) };
    });

    const usuarioId = await obtenerUsuarioIdDesdeRequest(req);
    const pagos = resultado.venta.pagos.map((p) => `${p.metodo}: $${formatearMoneda(p.monto)}`).join(", ");
    await registrarAuditoria(
      usuarioId,
      "reabrir_venta_mesa",
      `Venta #${resultado.venta.id} vuelta a ${resultado.mesa.apodo || resultado.mesa.nombre}${resultado.unida ? " (sumada a la cuenta abierta)" : ""} · Productos: $${formatearMoneda(resultado.subtotal)} · Pagos anulados: ${pagos || "ninguno"}`
    );
    return NextResponse.json({ success: true, mesaId: resultado.mesa.id });
  } catch (error) {
    if (error instanceof ErrorReabrir) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    console.error("Error reabriendo venta:", error);
    return NextResponse.json({ error: "No se pudo volver la venta a la mesa" }, { status: 500 });
  }
}
