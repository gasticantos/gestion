import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const body = await req.json();
  const { nombre, telefono, personas, fecha, mesaId, notas, estado } = body;

  const reserva = await prisma.reserva.update({
    where: { id: Number(id) },
    data: {
      nombre,
      telefono: telefono || null,
      personas: personas !== undefined ? Number(personas) : undefined,
      fecha: fecha ? new Date(fecha) : undefined,
      mesaId: mesaId ? Number(mesaId) : null,
      notas: notas || null,
      estado,
    },
  });
  return NextResponse.json(reserva);
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const reserva = await prisma.reserva.update({
    where: { id: Number(id) },
    data: { estado: "CANCELADA" },
  });
  return NextResponse.json(reserva);
}
