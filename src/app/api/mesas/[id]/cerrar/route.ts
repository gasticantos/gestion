import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { sesionActual } from "@/lib/sesionServidor";
import { aplicarDescuento } from "@/lib/precio";
import { obtenerUsuarioIdDesdeRequest, registrarAuditoria } from "@/lib/auditoria";

type PagoInput = { metodo: "EFECTIVO" | "TARJETA" | "TRANSFERENCIA" | "FIADO"; monto: number };

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const sesion = await sesionActual();
  if (sesion?.rol === "MOZO") {
    return NextResponse.json({ error: "No tenés permiso para cobrar" }, { status: 403 });
  }

  const { id } = await params;
  const body = await req.json();
  const { pagos, clienteId, descuentoPct } = body as {
    pagos: PagoInput[];
    clienteId?: number | null;
    descuentoPct?: number;
  };

  const mesa = await prisma.mesa.findUnique({
    where: { id: Number(id) },
    include: { ventas: { where: { estado: "ABIERTA" } } },
  });
  if (!mesa) {
    return NextResponse.json({ error: "Mesa no encontrada" }, { status: 404 });
  }
  const venta = mesa.ventas[0];
  if (!venta) {
    return NextResponse.json({ error: "La mesa no tiene una cuenta abierta" }, { status: 409 });
  }
  if (!Array.isArray(pagos) || pagos.length === 0) {
    return NextResponse.json({ error: "Falta indicar el pago" }, { status: 400 });
  }

  const tieneFiado = pagos.some((p) => p.metodo === "FIADO");
  if (tieneFiado && !clienteId) {
    return NextResponse.json({ error: "Elegí un cliente para la parte fiada" }, { status: 400 });
  }

  const { pct, total } = aplicarDescuento(venta.total, Number(descuentoPct) || 0);

  const totalPagos = pagos.reduce((acc, p) => acc + Number(p.monto), 0);
  if (Math.abs(totalPagos - total) > 0.01) {
    return NextResponse.json({ error: "El total pagado no coincide con el total de la cuenta" }, { status: 400 });
  }

  const cerrada = await prisma.$transaction(async (tx) => {
    const updated = await tx.venta.update({
      where: { id: venta.id },
      data: {
        estado: "CERRADA",
        closedAt: new Date(),
        clienteId: clienteId ? Number(clienteId) : null,
        total,
        descuentoPct: pct,
        pagos: { create: pagos.map((p) => ({ metodo: p.metodo, monto: Number(p.monto) })) },
      },
    });

    await tx.mesa.update({ where: { id: mesa.id }, data: { estado: "LIBRE" } });

    const montoFiado = pagos.filter((p) => p.metodo === "FIADO").reduce((acc, p) => acc + Number(p.monto), 0);
    if (montoFiado > 0 && clienteId) {
      await tx.movimientoCuentaCorriente.create({
        data: { clienteId: Number(clienteId), tipo: "CARGO", monto: montoFiado, ventaId: updated.id },
      });
      await tx.cliente.update({
        where: { id: Number(clienteId) },
        data: { saldo: { increment: montoFiado } },
      });
    }

    return updated;
  });

  const usuarioId = await obtenerUsuarioIdDesdeRequest(req);
  const detallesPago = pagos.map((p) => `${p.metodo}: $${p.monto}`).join(", ");
  await registrarAuditoria(usuarioId, "cerrar_mesa", `Mesa ${mesa.nombre} - Total: $${total} - Pagos: ${detallesPago}`);

  return NextResponse.json(cerrada);
}
