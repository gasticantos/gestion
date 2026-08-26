import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { sesionActual } from "@/lib/sesionServidor";
import { aplicarDescuento } from "@/lib/precio";
import { obtenerUsuarioIdDesdeRequest, registrarAuditoria } from "@/lib/auditoria";
import { formatearMoneda } from "@/lib/formato";

const METODOS_PARCIALES = ["EFECTIVO", "TARJETA", "TRANSFERENCIA"] as const;

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const sesion = await sesionActual();
  if (!sesion || sesion.rol === "MOZO") {
    return NextResponse.json({ error: "No tenés permiso para registrar pagos" }, { status: 403 });
  }

  const { id } = await params;
  const body = await req.json().catch(() => ({}));
  const metodo = String(body.metodo || "") as (typeof METODOS_PARCIALES)[number];
  const monto = Math.round(Number(body.monto) * 100) / 100;
  if (!METODOS_PARCIALES.includes(metodo) || !Number.isFinite(monto) || monto <= 0) {
    return NextResponse.json({ error: "Indicá un medio y un monto válido" }, { status: 400 });
  }

  const mesa = await prisma.mesa.findUnique({
    where: { id: Number(id) },
    include: {
      ventas: {
        where: { estado: "ABIERTA" },
        include: { pagos: true },
      },
    },
  });
  const venta = mesa?.ventas[0];
  if (!mesa || !venta) {
    return NextResponse.json({ error: "La mesa no tiene una cuenta abierta" }, { status: 409 });
  }
  if (!venta.ticketImpreso) {
    return NextResponse.json({ error: "Primero emití el preticket" }, { status: 409 });
  }

  const descuentoPct = venta.pagos.length
    ? venta.descuentoPct
    : aplicarDescuento(venta.total, Number(body.descuentoPct) || 0).pct;
  const totalConDescuento = aplicarDescuento(venta.total, descuentoPct).total;
  const pagado = venta.pagos.reduce((suma, pago) => suma + pago.monto, 0);
  const saldo = Math.round((totalConDescuento - pagado) * 100) / 100;
  if (monto - saldo > 0.01) {
    return NextResponse.json(
      { error: `El pago supera el saldo pendiente de $${formatearMoneda(Math.max(0, saldo))}` },
      { status: 400 }
    );
  }

  await prisma.$transaction([
    prisma.pago.create({ data: { ventaId: venta.id, metodo, monto } }),
    prisma.venta.update({ where: { id: venta.id }, data: { descuentoPct } }),
  ]);

  const usuarioId = await obtenerUsuarioIdDesdeRequest(req);
  await registrarAuditoria(
    usuarioId,
    "pago_parcial_mesa",
    `${mesa.apodo || mesa.nombre} · Venta #${venta.id} · ${metodo}: $${formatearMoneda(monto)}`
  );
  return NextResponse.json({ success: true });
}
