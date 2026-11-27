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
    // Solo se permite dar de alta; dar de baja no está permitido.
    data: { nombre, telefono: telefono || null, ...(activo === true ? { activo: true } : {}) },
  });
  return NextResponse.json(cliente);
}

// Los clientes no se dan de baja: pueden tener cuenta corriente con saldo o historial.
export async function DELETE() {
  return NextResponse.json({ error: "Los clientes no se pueden dar de baja" }, { status: 409 });
}
