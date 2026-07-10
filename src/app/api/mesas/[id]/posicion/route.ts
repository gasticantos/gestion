import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const body = await req.json();
  const { posX, posY } = body as { posX: number; posY: number };

  if (isNaN(Number(posX)) || isNaN(Number(posY))) {
    return NextResponse.json({ error: "Posición inválida" }, { status: 400 });
  }

  const mesa = await prisma.mesa.update({
    where: { id: Number(id) },
    data: { posX: Number(posX), posY: Number(posY) },
  });
  return NextResponse.json(mesa);
}
