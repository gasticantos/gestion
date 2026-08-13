import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { Prisma } from "@/generated/prisma/client";
import { precioSegunTarifa, Tarifa } from "@/lib/precio";
import { sesionActual } from "@/lib/sesionServidor";
import { ROL_LABEL } from "@/lib/permisos";
import { formatearFechaHora } from "@/lib/formato";

type ItemInput = { productoId: number; cantidad: number; tarifa?: Tarifa; notas?: string; precioUnitario?: number };

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const sesion = await sesionActual();
  const { id } = await params;
  const body = await req.json();
  const { items } = body as { items: ItemInput[] };

  if (!Array.isArray(items) || items.length === 0) {
    return NextResponse.json({ error: "Agregá al menos un producto" }, { status: 400 });
  }
  if (
    items.some(
      (item) =>
        !Number.isFinite(Number(item.cantidad)) ||
        Number(item.cantidad) <= 0 ||
        String(item.notas || "").length > 200
    )
  ) {
    return NextResponse.json({ error: "Revisá la cantidad y las notas" }, { status: 400 });
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
  const configuracion = await prisma.configuracion.findFirst();
  const precioMesaActivo = configuracion?.precioMesaActivo !== false;

  for (const item of items) {
    const producto = porId.get(Number(item.productoId));
    if (!producto) {
      return NextResponse.json({ error: "Producto no encontrado" }, { status: 400 });
    }
  }

  const itemTarifa = (item: ItemInput): Tarifa =>
    precioMesaActivo && item.tarifa !== "PARTICULAR" ? "MESA" : "PARTICULAR";

  // Si el mozo/cajero eligió un precio a mano al agregar el producto, respetarlo
  // en lugar de recalcularlo por tarifa.
  const precioItem = (item: ItemInput, producto: (typeof productos)[number]) =>
    typeof item.precioUnitario === "number" && Number.isFinite(item.precioUnitario) && item.precioUnitario >= 0
      ? item.precioUnitario
      : precioSegunTarifa(producto, itemTarifa(item));

  const subtotalPedido = items.reduce((acc, item) => {
    const producto = porId.get(Number(item.productoId))!;
    return acc + precioItem(item, producto) * Number(item.cantidad);
  }, 0);

  const pedido = await prisma.$transaction(async (tx) => {
    const created = await tx.pedido.create({
      data: {
        ventaId: venta.id,
        creadoPorId: sesion ? Number(sesion.sub) : null,
        items: {
          create: items.map((item) => {
            const producto = porId.get(Number(item.productoId))!;
            const precioUnitario = precioItem(item, producto);
            return {
              productoId: producto.id,
              cantidad: Number(item.cantidad),
              precioUnitario,
              subtotal: precioUnitario * Number(item.cantidad),
              notas: item.notas?.trim().slice(0, 200) || null,
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

    // La comanda se crea dentro de la misma transacción que el pedido. Antes el navegador
    // hacía una segunda llamada y, si se cortaba la conexión entre ambas, el producto quedaba
    // agregado pero sin trabajo de impresión.
    const itemsPorImpresora = new Map<string, typeof created.items>();
    for (const item of created.items) {
      const destino = item.producto.impresora?.trim() || "";
      const grupo = itemsPorImpresora.get(destino) || [];
      grupo.push(item);
      itemsPorImpresora.set(destino, grupo);
    }

    const nombreUsuario = sesion?.nombre || "Usuario";
    const rolUsuario = sesion?.rol;
    const trabajos = [];
    for (const [impresora, itemsDestino] of itemsPorImpresora) {
      const lineas: string[] = [
        `[[TITLE]] ${(configuracion?.nombrePrograma || "GESTION").toUpperCase()}`,
        "[[SUBTITLE]] COMANDA",
        "[[HR]]",
        `[[HERO]] ${(mesa.apodo || mesa.nombre || "Mostrador").toUpperCase()}`,
        `[[CENTER]] ${nombreUsuario.toUpperCase()}${rolUsuario ? ` - ${ROL_LABEL[rolUsuario]}` : ""}`,
        `[[CENTER]] ${formatearFechaHora(created.createdAt)} - Pedido #${created.id}`,
        "[[HR]]",
        "[[SECTION]] PRODUCTOS",
      ];
      for (const item of itemsDestino) {
        lineas.push(`[[ITEM]] ${item.cantidad} x ${item.producto.nombre}`);
        if (item.notas) {
          const notaLimpia = item.notas
            .split(/\r?\n/)
            .map((linea) => linea.replace(/[ \t]+/g, " ").trim())
            .join("<<BR>>")
            .toUpperCase();
          lineas.push(`[[NOTE]] NOTA: ${notaLimpia}`);
        }
      }
      lineas.push("[[HR]]", "[[FOOTER]] Comanda de cocina", "");
      trabajos.push(
        await tx.impresionTrabajo.create({
          data: {
            tipo: "COMANDA",
            contenido: lineas.join("\n"),
            impresora: impresora || null,
          },
          select: { id: true },
        })
      );
    }

    await tx.pedido.update({
      where: { id: created.id },
      data: { comandaImpresa: true },
    });

    return {
      ...created,
      trabajoIds: trabajos.map((trabajo) => trabajo.id),
      ventaTotal: venta.total + subtotalPedido,
    };
  });

  return NextResponse.json(pedido, { status: 201 });
}
