import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { Tarifa } from "@/lib/precio";

export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const body = await req.json();
  const tarifa: Tarifa = body.tarifa === "PARTICULAR" ? "PARTICULAR" : "MESA";

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

  const actualizada = await prisma.venta.update({ where: { id: venta.id }, data: { tarifa } });
  return NextResponse.json(actualizada);
}
