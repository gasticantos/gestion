import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { sesionActual } from "@/lib/sesionServidor";

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const sesion = await sesionActual();
  if (!sesion) return NextResponse.json({ error: "No autenticado" }, { status: 401 });
  if (sesion.rol !== "DUENIO") {
    return NextResponse.json({ error: "Solo el dueño puede eliminar flyers" }, { status: 403 });
  }

  const { id } = await params;
  const resultado = await prisma.flyer.deleteMany({
    where: { id: Number(id), negocioId: sesion.negocioId },
  });
  if (resultado.count === 0) {
    return NextResponse.json({ error: "Flyer no encontrado" }, { status: 404 });
  }
  return NextResponse.json({ success: true });
}
