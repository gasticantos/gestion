import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET() {
  try {
    const mesas = await prisma.mesa.findMany({
      include: {
        ventas: {
          where: { estado: "ABIERTA" },
          select: { id: true, total: true, ticketImpreso: true },
        },
      },
      orderBy: { nombre: "asc" },
    });
    return NextResponse.json(mesas);
  } catch (error) {
    console.error("Error fetching mesas:", error);
    return NextResponse.json({ error: "Error al cargar mesas" }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  const mesas = await prisma.mesa.findMany({ select: { nombre: true } });

  const numeros = mesas
    .map((m) => {
      const match = m.nombre.match(/^Mesa (\d+)$/);
      return match ? parseInt(match[1], 10) : 0;
    })
    .filter((n) => n > 0);

  const siguienteNumero = numeros.length > 0 ? Math.max(...numeros) + 1 : 1;
  const nombre = `Mesa ${siguienteNumero}`;

  const cantidad = mesas.length;
  const columnas = 5;
  const espaciado = 140;
  const posX = 40 + (cantidad % columnas) * espaciado;
  const posY = 40 + Math.floor(cantidad / columnas) * espaciado;

  const mesa = await prisma.mesa.create({ data: { nombre, numero: siguienteNumero, posX, posY } });
  return NextResponse.json(mesa, { status: 201 });
}
