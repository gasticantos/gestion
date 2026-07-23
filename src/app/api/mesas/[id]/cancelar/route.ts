import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { obtenerUsuarioIdDesdeRequest, registrarAuditoria } from "@/lib/auditoria";

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const mesaId = Number(id);

  const mesa = await prisma.mesa.findUnique({
    where: { id: mesaId },
    include: { ventas: { where: { estado: "ABIERTA" }, include: { pedidos: { include: { items: true } } } } },
  });

  if (!mesa) {
    return NextResponse.json({ error: "Mesa no encontrada" }, { status: 404 });
  }

  const venta = mesa.ventas[0];
  if (!venta) {
    return NextResponse.json({ error: "La mesa no tiene una cuenta abierta" }, { status: 409 });
  }

  const tieneItems = venta.pedidos.some((p) => p.items.length > 0);
  if (tieneItems) {
    return NextResponse.json({ error: "No se puede cancelar una mesa con productos cargados" }, { status: 409 });
  }

  await prisma.$transaction([
    prisma.venta.delete({ where: { id: venta.id } }),
    prisma.mesa.update({ where: { id: mesa.id }, data: { estado: "LIBRE" } }),
  ]);

  const usuarioId = await obtenerUsuarioIdDesdeRequest(req);
  await registrarAuditoria(usuarioId, "cancelar_mesa", `Mesa ${mesa.nombre} (ID: ${mesa.id})`);

  return NextResponse.json({ success: true });
}
