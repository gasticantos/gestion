import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { Tarifa } from "@/lib/precio";

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const body = await req.json().catch(() => ({}));
  const tarifa: Tarifa = body.tarifa === "PARTICULAR" ? "PARTICULAR" : "MESA";

  const mesa = await prisma.mesa.findUnique({ where: { id: Number(id) } });

  if (!mesa) {
    return NextResponse.json({ error: "Mesa no encontrada" }, { status: 404 });
  }
  if (mesa.estado === "OCUPADA") {
    return NextResponse.json({ error: "La mesa ya está ocupada" }, { status: 409 });
  }

  const [venta] = await prisma.$transaction([
    prisma.venta.create({ data: { tipo: "MESA", mesaId: mesa.id, estado: "ABIERTA", total: 0, tarifa } }),
    prisma.mesa.update({ where: { id: mesa.id }, data: { estado: "OCUPADA" } }),
  ]);

  return NextResponse.json(venta, { status: 201 });
}
