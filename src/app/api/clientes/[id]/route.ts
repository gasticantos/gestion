import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const cliente = await prisma.cliente.findUnique({
    where: { id: Number(id) },
    include: { movimientos: { orderBy: { createdAt: "desc" } } },
  });
  if (!cliente) {
    return NextResponse.json({ error: "Cliente no encontrado" }, { status: 404 });
  }
  return NextResponse.json(cliente);
}

export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const body = await req.json();
  const { nombre, telefono, activo } = body;

  const cliente = await prisma.cliente.update({
    where: { id: Number(id) },
    data: { nombre, telefono: telefono || null, activo },
  });
  return NextResponse.json(cliente);
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const cliente = await prisma.cliente.update({
    where: { id: Number(id) },
    data: { activo: false },
  });
  return NextResponse.json(cliente);
}
