import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const mesa = await prisma.mesa.findUnique({
    where: { id: Number(id) },
    include: {
      ventas: {
        where: { estado: "ABIERTA" },
        include: {
          pedidos: { include: { items: { include: { producto: true } } }, orderBy: { createdAt: "asc" } },
        },
      },
    },
  });

  if (!mesa) {
    return NextResponse.json({ error: "Mesa no encontrada" }, { status: 404 });
  }
  return NextResponse.json(mesa);
}
