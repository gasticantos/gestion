import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET() {
  const entradas = await prisma.stockEntry.findMany({
    include: { proveedor: true, items: { include: { producto: true } } },
    orderBy: { createdAt: "desc" },
    take: 50,
  });
  return NextResponse.json(entradas);
}

type ItemInput = { productoId: number; cantidad: number; costoUnitario: number };

export async function POST(req: NextRequest) {
  const body = await req.json();
  const { proveedorId, tipo, notas, items } = body as {
    proveedorId?: number | null;
    tipo?: "ENTRADA" | "AJUSTE";
    notas?: string | null;
    items: ItemInput[];
  };

  if (!Array.isArray(items) || items.length === 0) {
    return NextResponse.json({ error: "Agregá al menos un producto" }, { status: 400 });
  }
  for (const item of items) {
    if (!item.productoId || !item.cantidad || isNaN(Number(item.cantidad))) {
      return NextResponse.json({ error: "Cada ítem necesita producto y cantidad" }, { status: 400 });
    }
  }

  const entrada = await prisma.$transaction(async (tx) => {
    const created = await tx.stockEntry.create({
      data: {
        proveedorId: proveedorId ? Number(proveedorId) : null,
        tipo: tipo === "AJUSTE" ? "AJUSTE" : "ENTRADA",
        notas: notas || null,
        items: {
          create: items.map((item) => ({
            productoId: Number(item.productoId),
            cantidad: Number(item.cantidad),
            costoUnitario: Number(item.costoUnitario) || 0,
          })),
        },
      },
      include: { items: true },
    });

    for (const item of created.items) {
      await tx.producto.update({
        where: { id: item.productoId },
        data: {
          stock: { increment: item.cantidad },
          ...(created.tipo === "ENTRADA" && item.costoUnitario > 0
            ? { precioCosto: item.costoUnitario }
            : {}),
        },
      });
    }

    return created;
  });

  return NextResponse.json(entrada, { status: 201 });
}
