import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { obtenerUsuarioIdDesdeRequest, registrarAuditoria } from "@/lib/auditoria";

export async function PUT(req: NextRequest, { params }: { params: Promise<{ itemId: string }> }) {
  const { itemId } = await params;
  const body = await req.json();
  const { cantidad, precioUnitario } = body as { cantidad?: number; precioUnitario?: number };

  try {
    const item = await prisma.pedidoItem.findUnique({ where: { id: Number(itemId) } });
    if (!item) {
      return NextResponse.json({ error: "Item no encontrado" }, { status: 404 });
    }

    const cantidadFinal = cantidad ?? item.cantidad;
    const precioFinal = precioUnitario ?? item.precioUnitario;

    if (cantidadFinal <= 0) {
      return NextResponse.json({ error: "Cantidad debe ser mayor a 0" }, { status: 400 });
    }

    const nuevoSubtotal = cantidadFinal * precioFinal;
    const updated = await prisma.pedidoItem.update({
      where: { id: Number(itemId) },
      data: { cantidad: cantidadFinal, precioUnitario: precioFinal, subtotal: nuevoSubtotal },
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
    const item = await prisma.pedidoItem.findUnique({
      where: { id: Number(itemId) },
      include: {
        producto: { select: { nombre: true } },
        pedido: {
          select: {
            ventaId: true,
            venta: {
              select: {
                mesa: { select: { id: true, nombre: true, apodo: true } },
              },
            },
          },
        },
      },
    });
    if (!item) {
      return NextResponse.json({ error: "Item no encontrado" }, { status: 404 });
    }

    await prisma.$transaction([
      prisma.pedidoItem.delete({ where: { id: Number(itemId) } }),
      prisma.producto.update({
        where: { id: item.productoId },
        data: { stock: { increment: item.cantidad } },
      }),
      prisma.venta.update({
        where: { id: item.pedido.ventaId },
        data: { total: { decrement: item.subtotal } },
      }),
    ]);

    const usuarioId = await obtenerUsuarioIdDesdeRequest(req);
    const mesa = item.pedido.venta.mesa;
    const nombreMesa = mesa?.apodo || mesa?.nombre || "Mostrador";
    await registrarAuditoria(
      usuarioId,
      "quitar_producto_mesa",
      `${item.cantidad} x ${item.producto.nombre} quitado de ${nombreMesa} · Venta #${item.pedido.ventaId}`
    );

    return NextResponse.json({
      success: true,
      totalDescontado: item.subtotal,
      stockDevuelto: item.cantidad,
    });
  } catch (err) {
    return NextResponse.json({ error: "No se pudo eliminar el item" }, { status: 500 });
  }
}
