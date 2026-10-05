import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { obtenerUsuarioIdDesdeRequest, registrarAuditoria } from "@/lib/auditoria";
import { sesionActual } from "@/lib/sesionServidor";

export async function PUT(req: NextRequest, { params }: { params: Promise<{ itemId: string }> }) {
  const sesion = await sesionActual();
  const { itemId } = await params;
  const body = await req.json();
  const { cantidad, precioUnitario } = body as { cantidad?: number; precioUnitario?: number };

  try {
    const item = await prisma.pedidoItem.findUnique({
      where: { id: Number(itemId) },
      include: { pedido: { select: { ventaId: true, venta: { select: { ticketImpreso: true } } } } },
    });
    if (!item) {
      return NextResponse.json({ error: "Item no encontrado" }, { status: 404 });
    }
    if (item.pedido.venta.ticketImpreso) {
      return NextResponse.json(
        { error: "No se puede editar un producto después de emitir el preticket" },
        { status: 409 }
      );
    }

    // El mozo puede seguir corrigiendo el precio, pero no la cantidad de un producto ya
    // cargado en la mesa: evita que la "corrija" a un número que no es el real. Se compara
    // contra el valor guardado (no solo si vino en el body) para no bloquear un cambio de
    // precio que reenvía la misma cantidad sin tocarla.
    if (cantidad !== undefined && cantidad !== item.cantidad) {
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
  } catch {
    return NextResponse.json({ error: "No se pudo actualizar el item" }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ itemId: string }> }) {
  const sesion = await sesionActual();
  const { itemId } = await params;
  const body = await req.json().catch(() => ({}));
  const cantidadSolicitada = Number(body.cantidad);

  if ("cantidad" in body && (!Number.isFinite(cantidadSolicitada) || cantidadSolicitada <= 0)) {
    return NextResponse.json({ error: "Cantidad inválida" }, { status: 400 });
  }

  try {
    if (!sesion) return NextResponse.json({ error: "No autenticado" }, { status: 401 });
    const item = await prisma.pedidoItem.findUnique({
      where: { id: Number(itemId) },
      include: {
        producto: { select: { nombre: true } },
        pedido: {
          select: {
            ventaId: true,
            venta: {
              select: {
                ticketImpreso: true,
                negocioId: true,
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
    if (item.pedido.venta.negocioId !== sesion.negocioId) {
      return NextResponse.json({ error: "Item no encontrado" }, { status: 404 });
    }
    if (item.pedido.venta.ticketImpreso && sesion.rol !== "ADMIN") {
      return NextResponse.json(
        { error: "Solo un administrador puede quitar productos después de emitir el preticket" },
        { status: 403 }
      );
    }

    const cantidadEliminada = Number.isFinite(cantidadSolicitada) && cantidadSolicitada > 0
      ? Math.min(cantidadSolicitada, item.cantidad)
      : item.cantidad;
    const subtotalEliminado = cantidadEliminada * item.precioUnitario;
    const eliminarItemCompleto = cantidadEliminada >= item.cantidad;

    await prisma.$transaction(async (tx) => {
      if (eliminarItemCompleto) {
        await tx.pedidoItem.delete({ where: { id: Number(itemId) } });
      } else {
        await tx.pedidoItem.update({
          where: { id: Number(itemId) },
          data: {
            cantidad: { decrement: cantidadEliminada },
            subtotal: { decrement: subtotalEliminado },
          },
        });
      }
      await tx.producto.update({
        where: { id: item.productoId },
        data: { stock: { increment: cantidadEliminada } },
      });
      await tx.venta.update({
        where: { id: item.pedido.ventaId },
        data: { total: { decrement: subtotalEliminado } },
      });
      if (item.pedido.venta.ticketImpreso) {
        await tx.ajustePreticket.create({
          data: {
            ventaId: item.pedido.ventaId,
            productoId: item.productoId,
            productoNombre: item.producto.nombre,
            tipo: "QUITADO",
            cantidad: cantidadEliminada,
            precioUnitario: item.precioUnitario,
            subtotal: subtotalEliminado,
            usuarioId: Number(sesion.sub),
            usuarioNombre: sesion.nombre,
          },
        });
      }
    });

    const usuarioId = await obtenerUsuarioIdDesdeRequest(req);
    const mesa = item.pedido.venta.mesa;
    const nombreMesa = mesa?.apodo || mesa?.nombre || "Mostrador";
    await registrarAuditoria(
      usuarioId,
      "quitar_producto_mesa",
      `${cantidadEliminada} x ${item.producto.nombre} marcado como error de cuenta en ${nombreMesa} · Venta #${item.pedido.ventaId}`
    );
    return NextResponse.json({
      success: true,
      cantidadEliminada,
      totalDescontado: subtotalEliminado,
      stockDevuelto: cantidadEliminada,
    });
  } catch {
    return NextResponse.json({ error: "No se pudo eliminar el item" }, { status: 500 });
  }
}
