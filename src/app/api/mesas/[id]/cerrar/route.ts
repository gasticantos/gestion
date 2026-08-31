import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { sesionActual } from "@/lib/sesionServidor";
import { aplicarDescuento } from "@/lib/precio";
import { obtenerUsuarioIdDesdeRequest, registrarAuditoria } from "@/lib/auditoria";
import { enviarAlertaTelegram } from "@/lib/telegram";
import { formatearMoneda } from "@/lib/formato";

type PagoInput = { metodo: "EFECTIVO" | "TARJETA" | "TRANSFERENCIA" | "FIADO"; monto: number; tipoTarjeta?: "QR" | "DEBITO" | "CREDITO" | null };

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const sesion = await sesionActual();
  if (sesion?.rol === "MOZO") {
    return NextResponse.json({ error: "No tenés permiso para cobrar" }, { status: 403 });
  }

  const { id } = await params;
  const body = await req.json();
  const { pagos, clienteId, descuentoPct, descuentoResponsable, propina } = body as {
    pagos: PagoInput[];
    clienteId?: number | null;
    descuentoPct?: number;
    descuentoResponsable?: string | null;
    propina?: number;
  };

  const mesa = await prisma.mesa.findUnique({
    where: { id: Number(id) },
    include: { ventas: { where: { estado: "ABIERTA" }, include: { pagos: true } } },
  });
  if (!mesa) {
    return NextResponse.json({ error: "Mesa no encontrada" }, { status: 404 });
  }
  const venta = mesa.ventas[0];
  if (!venta) {
    return NextResponse.json({ error: "La mesa no tiene una cuenta abierta" }, { status: 409 });
  }
  if (!Array.isArray(pagos)) {
    return NextResponse.json({ error: "Falta indicar el pago" }, { status: 400 });
  }
  const propinaFinal = Math.round(Number(propina || 0) * 100) / 100;
  if (!Number.isFinite(propinaFinal) || propinaFinal < 0) {
    return NextResponse.json({ error: "La propina no es válida" }, { status: 400 });
  }

  const tieneFiado = pagos.some((p) => p.metodo === "FIADO");
  if (tieneFiado && !clienteId) {
    return NextResponse.json({ error: "Elegí un cliente para la parte fiada" }, { status: 400 });
  }

  const pctSolicitado = venta.pagos.length > 0 ? venta.descuentoPct : Number(descuentoPct) || 0;
  const { pct, monto: montoDescuento, total } = aplicarDescuento(venta.total, pctSolicitado);
  const responsableDescuento = String(descuentoResponsable || "").trim().slice(0, 80);
  if (pct > 0 && !responsableDescuento) {
    return NextResponse.json({ error: "Indicá quién aplica el descuento" }, { status: 400 });
  }

  const totalPagosPrevios = venta.pagos.reduce((acc, p) => acc + p.monto, 0);
  const totalPagos = totalPagosPrevios + pagos.reduce((acc, p) => acc + Number(p.monto), 0);
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
        descuentoResponsable: pct > 0 ? responsableDescuento : null,
        propina: propinaFinal,
        pagos: { create: pagos.map((p) => ({ metodo: p.metodo, monto: Number(p.monto), tipoTarjeta: p.metodo === "TARJETA" ? p.tipoTarjeta || "QR" : null })) },
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
  const detallesPago = [
    ...venta.pagos.map((p) => `${p.metodo}: $${p.monto}`),
    ...pagos.map((p) => `${p.metodo}: $${p.monto}`),
  ].join(", ");
  await registrarAuditoria(usuarioId, "cerrar_mesa", `Mesa ${mesa.nombre} - Total: $${total} - Pagos: ${detallesPago}`);

  if (pct > 0) {
    await enviarAlertaTelegram(
      `🏷️ Descuento aplicado\n${mesa.apodo || mesa.nombre} · Venta #${cerrada.id}\nSubtotal: $${formatearMoneda(venta.total)}\nDescuento: ${pct}% (-$${formatearMoneda(montoDescuento)})\nResponsable informado: ${responsableDescuento}\nTotal: $${formatearMoneda(total)}\nOperador del sistema: ${sesion?.nombre || "Usuario"} (${sesion?.rol || "sin rol"})`
    );
  }

  return NextResponse.json(cerrada);
}
