import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { obtenerUsuarioIdDesdeRequest, registrarAuditoria } from "@/lib/auditoria";
import { sesionActual } from "@/lib/sesionServidor";

export async function PUT(req: NextRequest, { params }: { params: Promise<{ itemId: string }> }) {
  const { itemId } = await params;
  const body = await req.json();
  const { cantidad, precioUnitario } = body as { cantidad?: number; precioUnitario?: number };

  try {
    const item = await prisma.pedidoItem.findUnique({
      where: { id: Number(itemId) },
      include: { pedido: { select: { ventaId: true } } },
    });
    if (!item) {
      return NextResponse.json({ error: "Item no encontrado" }, { status: 404 });
    }

    // El mozo puede seguir corrigiendo el precio, pero no la cantidad de un producto ya
    // cargado en la mesa: evita que la "corrija" a un número que no es el real. Se compara
    // contra el valor guardado (no solo si vino en el body) para no bloquear un cambio de
    // precio que reenvía la misma cantidad sin tocarla.
    if (cantidad !== undefined && cantidad !== item.cantidad) {
      const sesion = await sesionActual();
      if (sesion?.rol === "MOZO") {
        return NextResponse.json(
          { error: "No tenés permiso para cambiar la cantidad de un producto ya cargado" },
          { status: 403 }
        );
      }
    }

    const cantidadFinal = cantidad ?? item.cantidad;
    const precioFinal = precioUnitario ?? item.precioUnitario;

    if (cantidadFinal <= 0) {
      return NextResponse.json({ error: "Cantidad debe ser mayor a 0" }, { status: 400 });
    }

    const nuevoSubtotal = cantidadFinal * precioFinal;
    // Ajustar el total de la venta por la diferencia exacta que causa esta edición, no
    // recalcularlo sumando solo los ítems de ESTE pedido: cada producto agregado a una
    // mesa crea su propio pedido independiente (uno por comanda), así que sumar nada más
    // que "pedido.items" descartaba el total de todos los demás pedidos de la misma cuenta.
    const deltaSubtotal = nuevoSubtotal - item.subtotal;
    const deltaCantidad = cantidadFinal - item.cantidad;

    const [updated] = await prisma.$transaction([
      prisma.pedidoItem.update({
        where: { id: Number(itemId) },
        data: { cantidad: cantidadFinal, precioUnitario: precioFinal, subtotal: nuevoSubtotal },
      }),
      prisma.venta.update({
        where: { id: item.pedido.ventaId },
        data: { total: { increment: deltaSubtotal } },
      }),
      prisma.producto.update({
        where: { id: item.productoId },
        data: { stock: { decrement: deltaCantidad } },
      }),
    ]);

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
