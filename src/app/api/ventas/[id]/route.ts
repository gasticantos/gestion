import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const venta = await prisma.venta.findUnique({
    where: { id: Number(id) },
    include: {
      mesa: true,
      cliente: true,
      pagos: true,
      pedidos: { include: { items: { include: { producto: true } } }, orderBy: { createdAt: "asc" } },
    },
  });

  if (!venta) {
    return NextResponse.json({ error: "Venta no encontrada" }, { status: 404 });
  }
  return NextResponse.json(venta);
}
