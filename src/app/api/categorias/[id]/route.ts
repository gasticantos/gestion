import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const body = await req.json();
  const { nombre, activo } = body;

  try {
    const categoria = await prisma.categoria.update({
      where: { id: Number(id) },
      data: { nombre, activo },
    });
    return NextResponse.json(categoria);
  } catch {
    return NextResponse.json({ error: "Ya existe una categoría con ese nombre" }, { status: 409 });
  }
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  // Baja lógica: los productos que ya la tienen asignada la conservan en su historial.
  const categoria = await prisma.categoria.update({
    where: { id: Number(id) },
    data: { activo: false },
  });
  return NextResponse.json(categoria);
}
