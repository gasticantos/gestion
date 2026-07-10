import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET() {
  const reservas = await prisma.reserva.findMany({
    include: { mesa: true },
    orderBy: { fecha: "asc" },
  });
  return NextResponse.json(reservas);
}

export async function POST(req: NextRequest) {
  const body = await req.json();
  const { nombre, telefono, personas, fecha, mesaId, notas } = body;

  if (!nombre || typeof nombre !== "string") {
    return NextResponse.json({ error: "El nombre es obligatorio" }, { status: 400 });
  }
  if (!personas || isNaN(Number(personas)) || Number(personas) < 1) {
    return NextResponse.json({ error: "La cantidad de personas debe ser al menos 1" }, { status: 400 });
  }
  if (!fecha || isNaN(new Date(fecha).getTime())) {
    return NextResponse.json({ error: "La fecha y hora son obligatorias" }, { status: 400 });
  }

  const reserva = await prisma.reserva.create({
    data: {
      nombre,
      telefono: telefono || null,
      personas: Number(personas),
      fecha: new Date(fecha),
      mesaId: mesaId ? Number(mesaId) : null,
      notas: notas || null,
    },
  });
  return NextResponse.json(reserva, { status: 201 });
}
