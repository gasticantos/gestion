import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { Prisma } from "@/generated/prisma/client";

export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const body = await req.json();
  const { ronda } = body as { ronda: Prisma.InputJsonValue[] };

  const mesa = await prisma.mesa.findUnique({
    where: { id: Number(id) },
    include: { ventas: { where: { estado: "ABIERTA" } } },
  });
  const venta = mesa?.ventas[0];
  if (!venta) {
    return NextResponse.json({ error: "La mesa no tiene una cuenta abierta" }, { status: 409 });
  }

  await prisma.venta.update({
    where: { id: venta.id },
    data: { borradorRonda: ronda.length > 0 ? ronda : Prisma.JsonNull },
  });

  return NextResponse.json({ ok: true });
}
