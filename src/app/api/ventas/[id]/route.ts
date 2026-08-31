import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { sesionActual } from "@/lib/sesionServidor";
import { obtenerUsuarioIdDesdeRequest, registrarAuditoria } from "@/lib/auditoria";

const METODOS = ["EFECTIVO", "TARJETA", "TRANSFERENCIA", "FIADO"] as const;
type MetodoPago = (typeof METODOS)[number];

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const venta = await prisma.venta.findUnique({
    where: { id: Number(id) },
    include: {
      mesa: true,
      cliente: true,
      pagos: true,
      pedidos: { include: { items: { include: { producto: true } } }, orderBy: { createdAt: "asc" } },
    },
  });

  if (!venta) {
    return NextResponse.json({ error: "Venta no encontrada" }, { status: 404 });
  }
  return NextResponse.json(venta);
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const sesion = await sesionActual();
  if (!sesion) return NextResponse.json({ error: "No autenticado" }, { status: 401 });

  const { id } = await params;
  const ventaId = Number(id);
  const body = await req.json().catch(() => null);
  const pagos = body?.pagos as { id: number; metodo: MetodoPago }[] | undefined;

  if (!Number.isInteger(ventaId) || !Array.isArray(pagos) || pagos.length === 0) {
    return NextResponse.json({ error: "Datos de pago inválidos" }, { status: 400 });
  }
  if (pagos.some((p) => !Number.isInteger(Number(p.id)) || !METODOS.includes(p.metodo))) {
    return NextResponse.json({ error: "Método de pago inválido" }, { status: 400 });
  }

  const venta = await prisma.venta.findFirst({
    where: { id: ventaId, negocioId: sesion.negocioId, estado: "CERRADA" },
    include: { pagos: { orderBy: { id: "asc" } } },
  });
  if (!venta) return NextResponse.json({ error: "Venta no encontrada" }, { status: 404 });

  const idsRecibidos = new Set(pagos.map((p) => Number(p.id)));
  if (idsRecibidos.size !== venta.pagos.length || venta.pagos.some((p) => !idsRecibidos.has(p.id))) {
    return NextResponse.json({ error: "Los pagos de la venta no coinciden" }, { status: 400 });
  }

  const metodoPorId = new Map(pagos.map((p) => [Number(p.id), p.metodo]));
  const fiadoAnterior = venta.pagos
    .filter((p) => p.metodo === "FIADO")
    .reduce((total, p) => total + p.monto, 0);
  const fiadoNuevo = venta.pagos
    .filter((p) => metodoPorId.get(p.id) === "FIADO")
    .reduce((total, p) => total + p.monto, 0);
  const deltaFiado = fiadoNuevo - fiadoAnterior;

  if (fiadoNuevo > 0 && !venta.clienteId) {
    return NextResponse.json({ error: "Esta venta no tiene un cliente asignado para usar cuenta corriente" }, { status: 400 });
  }

  await prisma.$transaction(async (tx) => {
    for (const pago of venta.pagos) {
      await tx.pago.update({
        where: { id: pago.id },
        data: { metodo: metodoPorId.get(pago.id)! },
      });
    }

    if (venta.clienteId && Math.abs(deltaFiado) > 0.001) {
      await tx.movimientoCuentaCorriente.deleteMany({ where: { ventaId: venta.id, tipo: "CARGO" } });
      if (fiadoNuevo > 0) {
        await tx.movimientoCuentaCorriente.create({
          data: { clienteId: venta.clienteId, tipo: "CARGO", monto: fiadoNuevo, ventaId: venta.id },
        });
      }
      await tx.cliente.update({
        where: { id: venta.clienteId },
        data: { saldo: { increment: deltaFiado } },
      });
    }
  });

  const antes = venta.pagos.map((p) => p.metodo).join(" + ");
  const despues = venta.pagos.map((p) => metodoPorId.get(p.id)).join(" + ");
  const usuarioId = await obtenerUsuarioIdDesdeRequest(req);
  await registrarAuditoria(usuarioId, "editar_pago_venta", `Venta #${venta.id}: ${antes} -> ${despues}`);

  const actualizada = await prisma.venta.findUnique({
    where: { id: venta.id },
    select: { pagos: { select: { id: true, metodo: true, monto: true }, orderBy: { id: "asc" } } },
  });
  return NextResponse.json(actualizada);
}
