import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET() {
  const mesas = await prisma.mesa.findMany({
    include: {
      ventas: {
        where: { estado: "ABIERTA" },
        include: { pedidos: { include: { items: true } } },
      },
    },
    orderBy: { nombre: "asc" },
  });
  return NextResponse.json(mesas);
}

export async function POST(req: NextRequest) {
  const body = await req.json();
  const { nombre } = body;

  if (!nombre || typeof nombre !== "string") {
    return NextResponse.json({ error: "El nombre/número de mesa es obligatorio" }, { status: 400 });
  }

  const cantidad = await prisma.mesa.count();
  const columnas = 5;
  const espaciado = 140;
  const posX = 40 + (cantidad % columnas) * espaciado;
  const posY = 40 + Math.floor(cantidad / columnas) * espaciado;

  try {
    const mesa = await prisma.mesa.create({ data: { nombre, posX, posY } });
    return NextResponse.json(mesa, { status: 201 });
  } catch {
    return NextResponse.json({ error: "Ya existe una mesa con ese nombre" }, { status: 409 });
  }
}
