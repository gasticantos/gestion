import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { Prisma } from "@/generated/prisma/client";
import { calcularPrecio, Tarifa } from "@/lib/precio";

type ItemInput = { productoId: number; cantidad: number; tarifa?: Tarifa; notas?: string };

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const body = await req.json();
  const { items } = body as { items: ItemInput[] };

  if (!Array.isArray(items) || items.length === 0) {
    return NextResponse.json({ error: "Agregá al menos un producto" }, { status: 400 });
  }

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

  const productos = await prisma.producto.findMany({
    where: { id: { in: items.map((i) => Number(i.productoId)) } },
  });
  const porId = new Map(productos.map((p) => [p.id, p]));

  for (const item of items) {
    const producto = porId.get(Number(item.productoId));
    if (!producto) {
      return NextResponse.json({ error: "Producto no encontrado" }, { status: 400 });
    }
  }

  const config = await prisma.configuracion.findUnique({ where: { id: 1 } });
  const recargoMesaPct = config?.recargoMesaPct ?? 0;
  const itemTarifa = (item: ItemInput): Tarifa => (item.tarifa === "PARTICULAR" ? "PARTICULAR" : "MESA");

  const subtotalPedido = items.reduce((acc, item) => {
    const producto = porId.get(Number(item.productoId))!;
    return acc + calcularPrecio(producto.precioVenta, itemTarifa(item), recargoMesaPct) * Number(item.cantidad);
  }, 0);

  const pedido = await prisma.$transaction(async (tx) => {
    const created = await tx.pedido.create({
      data: {
        ventaId: venta.id,
        items: {
          create: items.map((item) => {
            const producto = porId.get(Number(item.productoId))!;
            const precioUnitario = calcularPrecio(producto.precioVenta, itemTarifa(item), recargoMesaPct);
            return {
              productoId: producto.id,
              cantidad: Number(item.cantidad),
              precioUnitario,
              subtotal: precioUnitario * Number(item.cantidad),
              notas: item.notas || null,
            };
          }),
        },
      },
      include: { items: { include: { producto: true } } },
    });

    for (const item of items) {
      await tx.producto.update({
        where: { id: Number(item.productoId) },
        data: { stock: { decrement: Number(item.cantidad) } },
      });
    }

    await tx.venta.update({
      where: { id: venta.id },
      data: { total: { increment: subtotalPedido }, borradorRonda: Prisma.JsonNull },
    });

    return created;
  });

  return NextResponse.json(pedido, { status: 201 });
}
