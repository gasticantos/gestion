import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const body = await req.json();
  const { nombre, telefono, contacto, notas, activo } = body;

  const proveedor = await prisma.proveedor.update({
    where: { id: Number(id) },
    data: { nombre, telefono: telefono || null, contacto: contacto || null, notas: notas || null, activo },
  });
  return NextResponse.json(proveedor);
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const proveedor = await prisma.proveedor.update({
    where: { id: Number(id) },
    data: { activo: false },
  });
  return NextResponse.json(proveedor);
}
