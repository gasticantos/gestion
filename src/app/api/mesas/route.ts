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
  try {
    const cantidad = await prisma.mesa.count();
    const maxNumero = await prisma.mesa.aggregate({ _max: { numero: true } });
    const siguienteNumero = (maxNumero._max.numero ?? 0) + 1;
    const nombre = `Mesa ${siguienteNumero}`;

    const columnas = 5;
    const espaciado = 140;
    const posX = 40 + (cantidad % columnas) * espaciado;
    const posY = 40 + Math.floor(cantidad / columnas) * espaciado;

    const mesa = await prisma.mesa.create({ data: { nombre, numero: siguienteNumero, posX, posY } });
    return NextResponse.json(mesa, { status: 201 });
  } catch (error) {
    console.error("Error creating mesa:", error);
    return NextResponse.json({ error: "No se pudo crear la mesa" }, { status: 500 });
  }
}
