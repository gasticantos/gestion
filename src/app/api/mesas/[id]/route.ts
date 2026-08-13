import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { sesionActual } from "@/lib/sesionServidor";

const ventaAbierta = {
  where: { estado: "ABIERTA" as const },
  select: {
    id: true,
    total: true,
    ticketImpreso: true,
    borradorRonda: true,
    pedidos: {
      select: {
        id: true,
        createdAt: true,
        items: {
          select: {
            id: true,
            productoId: true,
            cantidad: true,
            precioUnitario: true,
            subtotal: true,
            producto: { select: { nombre: true } },
          },
        },
      },
      orderBy: { createdAt: "asc" as const },
    },
  },
};

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const consultaMesa = prisma.mesa.findUnique({
    where: { id: Number(id) },
    include: { ventas: ventaAbierta },
  });

  if (req.nextUrl.searchParams.get("inicial") === "1") {
    const [mesa, productos, clientes, configuracion, sesion] = await Promise.all([
      consultaMesa,
      prisma.producto.findMany({
        where: { activo: true },
        select: {
          id: true,
          nombre: true,
          codigoBarras: true,
          precioVenta: true,
          precioVentaMesa: true,
          stock: true,
          requiereConfirmacion: true,
        },
        orderBy: { nombre: "asc" },
      }),
      prisma.cliente.findMany({
        where: { activo: true },
        select: { id: true, nombre: true, saldo: true },
        orderBy: { nombre: "asc" },
      }),
      prisma.configuracion.findFirst({ select: { precioMesaActivo: true } }),
      sesionActual(),
    ]);
    if (!mesa) {
      return NextResponse.json({ error: "Mesa no encontrada" }, { status: 404 });
    }
    return NextResponse.json({
      mesa,
      productos,
      clientes,
      precioMesaActivo: configuracion?.precioMesaActivo !== false,
      rol: sesion?.rol ?? null,
    });
  }

  const mesa = await consultaMesa;
  if (!mesa) {
    return NextResponse.json({ error: "Mesa no encontrada" }, { status: 404 });
  }
  return NextResponse.json(mesa);
}
