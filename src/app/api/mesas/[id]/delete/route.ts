import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { sesionActual } from "@/lib/sesionServidor";

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const sesion = await sesionActual();
  if (sesion?.rol === "MOZO") {
    return NextResponse.json({ error: "No tenés permiso para borrar mesas" }, { status: 403 });
  }

  const { id } = await params;
  const mesaId = Number(id);

  const mesa = await prisma.mesa.findUnique({
    where: { id: mesaId },
    include: { ventas: { include: { pedidos: { include: { items: true } } } } },
  });

  if (!mesa) {
    return NextResponse.json({ error: "Mesa no encontrada" }, { status: 404 });
  }

  // Verificar que no haya ventas abiertas
  const ventasAbiertas = mesa.ventas.filter((v) => v.estado === "ABIERTA");
  if (ventasAbiertas.length > 0) {
    return NextResponse.json({ error: "No se puede borrar una mesa con ventas abiertas" }, { status: 409 });
  }

  // Borrar mesa y revertir stock en una transacción
  await prisma.$transaction(async (tx) => {
    // Devolver stock de todas las ventas cerradas
    for (const venta of mesa.ventas) {
      for (const pedido of venta.pedidos) {
        for (const item of pedido.items) {
          await tx.producto.update({
            where: { id: item.productoId },
            data: { stock: { increment: item.cantidad } },
          });
        }
      }
    }

    // Borrar la mesa
    await tx.mesa.delete({ where: { id: mesaId } });
  });

  return NextResponse.json({ success: true });
}
