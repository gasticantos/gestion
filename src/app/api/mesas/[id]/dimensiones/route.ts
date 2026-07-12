import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const body = await req.json();
  const { ancho, alto } = body as { ancho: number; alto: number };

  if (!ancho || !alto || ancho < 40 || alto < 40) {
    return NextResponse.json({ error: "Dimensiones inválidas (mínimo 40)" }, { status: 400 });
  }

  try {
    const mesa = await prisma.mesa.update({
      where: { id: Number(id) },
      data: { ancho: Number(ancho), alto: Number(alto) },
    });
    return NextResponse.json(mesa);
  } catch {
    return NextResponse.json({ error: "No se pudo actualizar la mesa" }, { status: 500 });
  }
}
