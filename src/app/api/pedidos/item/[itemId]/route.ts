import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function PUT(req: NextRequest, { params }: { params: Promise<{ itemId: string }> }) {
  const { itemId } = await params;
  const body = await req.json();
  const { cantidad } = body as { cantidad: number };

  if (Number(cantidad) <= 0) {
    return NextResponse.json({ error: "Cantidad debe ser mayor a 0" }, { status: 400 });
  }

  try {
    const item = await prisma.pedidoItem.findUnique({ where: { id: Number(itemId) } });
    if (!item) {
      return NextResponse.json({ error: "Item no encontrado" }, { status: 404 });
    }

    const nuevoSubtotal = Number(cantidad) * item.precioUnitario;
    const updated = await prisma.pedidoItem.update({
      where: { id: Number(itemId) },
      data: { cantidad: Number(cantidad), subtotal: nuevoSubtotal },
    });

    const pedido = await prisma.pedido.findUnique({
      where: { id: item.pedidoId },
      include: { items: true },
    });
    if (pedido) {
      const nuevoTotal = pedido.items.reduce((acc, i) => acc + (i.id === Number(itemId) ? nuevoSubtotal : i.subtotal), 0);
      await prisma.venta.update({
        where: { id: pedido.ventaId },
        data: { total: nuevoTotal },
      });
    }

    return NextResponse.json(updated);
  } catch (err) {
    return NextResponse.json({ error: "No se pudo actualizar el item" }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ itemId: string }> }) {
  const { itemId } = await params;

  try {
    const item = await prisma.pedidoItem.findUnique({ where: { id: Number(itemId) } });
    if (!item) {
      return NextResponse.json({ error: "Item no encontrado" }, { status: 404 });
    }

    await prisma.pedidoItem.delete({ where: { id: Number(itemId) } });

    const pedido = await prisma.pedido.findUnique({
      where: { id: item.pedidoId },
      include: { items: true },
    });
    if (pedido) {
      const nuevoTotal = pedido.items.reduce((acc, i) => acc + i.subtotal, 0);
      await prisma.venta.update({
        where: { id: pedido.ventaId },
        data: { total: nuevoTotal },
      });
    }

    return NextResponse.json({ success: true });
  } catch (err) {
    return NextResponse.json({ error: "No se pudo eliminar el item" }, { status: 500 });
  }
}
