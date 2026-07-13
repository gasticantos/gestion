import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { calcularPrecio, Tarifa, aplicarDescuento } from "@/lib/precio";

type ItemInput = { productoId: number; cantidad: number; tarifa?: Tarifa };
type PagoInput = { metodo: "EFECTIVO" | "TARJETA" | "TRANSFERENCIA" | "FIADO"; monto: number };

export async function GET() {
  const ventas = await prisma.venta.findMany({
    where: { estado: "CERRADA" },
    select: {
      id: true,
      tipo: true,
      total: true,
      descuentoPct: true,
      closedAt: true,
      createdAt: true,
      clienteId: true,
      mesa: { select: { id: true, nombre: true } },
      pagos: { select: { metodo: true, monto: true } },
      pedidos: {
        select: {
          id: true,
          createdAt: true,
          items: {
            select: {
              id: true,
              cantidad: true,
              precioUnitario: true,
              subtotal: true,
              producto: { select: { id: true, nombre: true } },
            },
          },
        },
      },
    },
    orderBy: { closedAt: "desc" },
    take: 100,
  });
  return NextResponse.json(ventas);
}

export async function POST(req: NextRequest) {
  const body = await req.json();
  const { items, pagos, clienteId, descuentoPct } = body as {
    items: ItemInput[];
    pagos: PagoInput[];
    clienteId?: number | null;
    descuentoPct?: number;
  };

  if (!Array.isArray(items) || items.length === 0) {
    return NextResponse.json({ error: "El carrito está vacío" }, { status: 400 });
  }
  if (!Array.isArray(pagos) || pagos.length === 0) {
    return NextResponse.json({ error: "Falta indicar el pago" }, { status: 400 });
  }

  const tieneFiado = pagos.some((p) => p.metodo === "FIADO");
  if (tieneFiado && !clienteId) {
    return NextResponse.json({ error: "Elegí un cliente para la parte fiada" }, { status: 400 });
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
  const itemTarifa = (item: ItemInput): Tarifa => (item.tarifa === "MESA" ? "MESA" : "PARTICULAR");

  const subtotal = items.reduce((acc, item) => {
    const producto = porId.get(Number(item.productoId))!;
    return acc + calcularPrecio(producto.precioVenta, itemTarifa(item), recargoMesaPct) * Number(item.cantidad);
  }, 0);
  const { pct, total } = aplicarDescuento(subtotal, Number(descuentoPct) || 0);

  const totalPagos = pagos.reduce((acc, p) => acc + Number(p.monto), 0);
  if (Math.abs(totalPagos - total) > 0.01) {
    return NextResponse.json({ error: "El total pagado no coincide con el total de la venta" }, { status: 400 });
  }

  // Tarifa "resumen" de la venta: informativa, refleja si hubo algún ítem a precio de mesa.
  const tarifaResumen: Tarifa = items.some((i) => itemTarifa(i) === "MESA") ? "MESA" : "PARTICULAR";

  const venta = await prisma.$transaction(async (tx) => {
    const created = await tx.venta.create({
      data: {
        tipo: "MOSTRADOR",
        estado: "CERRADA",
        closedAt: new Date(),
        clienteId: clienteId ? Number(clienteId) : null,
        tarifa: tarifaResumen,
        total,
        descuentoPct: pct,
        pedidos: {
          create: {
            comandaImpresa: true,
            items: {
              create: items.map((item) => {
                const producto = porId.get(Number(item.productoId))!;
                const precioUnitario = calcularPrecio(producto.precioVenta, itemTarifa(item), recargoMesaPct);
                return {
                  productoId: producto.id,
                  cantidad: Number(item.cantidad),
                  precioUnitario,
                  subtotal: precioUnitario * Number(item.cantidad),
                };
              }),
            },
          },
        },
        pagos: {
          create: pagos.map((p) => ({ metodo: p.metodo, monto: Number(p.monto) })),
        },
      },
      include: { pedidos: { include: { items: { include: { producto: true } } } }, pagos: true },
    });

    for (const item of items) {
      await tx.producto.update({
        where: { id: Number(item.productoId) },
        data: { stock: { decrement: Number(item.cantidad) } },
      });
    }

    const montoFiado = pagos.filter((p) => p.metodo === "FIADO").reduce((acc, p) => acc + Number(p.monto), 0);
    if (montoFiado > 0 && clienteId) {
      await tx.movimientoCuentaCorriente.create({
        data: {
          clienteId: Number(clienteId),
          tipo: "CARGO",
          monto: montoFiado,
          ventaId: created.id,
        },
      });
      await tx.cliente.update({
        where: { id: Number(clienteId) },
        data: { saldo: { increment: montoFiado } },
      });
    }

    return created;
  });

  return NextResponse.json(venta, { status: 201 });
}
