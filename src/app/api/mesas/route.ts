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
    // Ocupa el número libre más bajo (1, 2, 3...) en vez de seguir siempre desde el
    // más alto: así, si una mesa numerada se renombra con un apodo (ver
    // /api/mesas/[id]/apodo, que la pasa a un número negativo para liberar su lugar) o
    // se borra, ese número vuelve a estar disponible para la próxima mesa nueva.
    const ocupados = await prisma.mesa.findMany({
      where: { numero: { gt: 0 } },
      select: { numero: true },
    });
    const usados = new Set(ocupados.map((m) => m.numero));
    let siguienteNumero = 1;
    while (usados.has(siguienteNumero)) siguienteNumero++;
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
