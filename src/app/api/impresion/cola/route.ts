import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

// La estación consulta esta ruta periódicamente. Los trabajos que quedaron tomados por
// una estación cerrada vuelven a estar disponibles después de dos minutos.
export async function GET(req: NextRequest) {
  const estacionId = req.nextUrl.searchParams.get("estacionId")?.trim();
  const configuracion = await prisma.configuracion.findFirst({
    select: { estacionImpresionId: true },
  });
  if (!estacionId || configuracion?.estacionImpresionId !== estacionId) {
    return NextResponse.json({ trabajos: [] });
  }

  const siguiente = req.nextUrl.searchParams.get("siguiente") === "1";
  const limite = siguiente ? 1 : 20;
  const impresorasDisponibles = req.nextUrl.searchParams
    .getAll("impresora")
    .map((nombre) => nombre.trim())
    .filter(Boolean);
  const haceDosMinutos = new Date(Date.now() - 2 * 60 * 1000);

  await prisma.impresionTrabajo.updateMany({
    where: { estado: "IMPRIMIENDO", claimedAt: { lt: haceDosMinutos } },
    data: { estado: "PENDIENTE", estacionId: null, claimedAt: null },
  });

  if (siguiente) {
    // Busca y toma el trabajo en la misma consulta: antes la estación hacía un segundo viaje
    // de red (POST "tomar") solo para reservarlo, y ese round-trip extra a la base era la
    // mayor parte de la demora entre mandar a imprimir y que salga el ticket.
    const candidatos = await prisma.impresionTrabajo.findMany({
      where: {
        estado: "PENDIENTE",
        OR: [
          { impresora: null },
          ...(impresorasDisponibles.length
            ? [{ impresora: { in: impresorasDisponibles } }]
            : []),
        ],
      },
      select: { id: true },
      orderBy: { createdAt: "asc" },
      take: 5,
    });

    for (const { id } of candidatos) {
      const tomado = await prisma.impresionTrabajo.updateMany({
        where: { id, estado: "PENDIENTE" },
        data: {
          estado: "IMPRIMIENDO",
          estacionId,
          claimedAt: new Date(),
          intentos: { increment: 1 },
          error: null,
        },
      });
      if (tomado.count === 1) {
        const trabajo = await prisma.impresionTrabajo.findUnique({
          where: { id },
          select: { id: true, tipo: true, contenido: true, impresora: true },
        });
        return NextResponse.json({ trabajos: trabajo ? [trabajo] : [] });
      }
    }
    return NextResponse.json({ trabajos: [] });
  }

  const trabajos = await prisma.impresionTrabajo.findMany({
    select: {
      id: true,
      tipo: true,
      contenido: true,
      impresora: true,
      estado: true,
      referencia: true,
      estacionId: true,
      error: true,
      intentos: true,
      createdAt: true,
      printedAt: true,
    },
    orderBy: { createdAt: "desc" },
    take: limite,
  });

  return NextResponse.json({ trabajos });
}

export async function POST(req: NextRequest) {
  const body = await req.json();

  if (body.accion === "prueba") {
    const trabajo = await prisma.impresionTrabajo.create({
      data: {
        tipo: "PRUEBA",
        contenido: String(body.contenido || "PRUEBA DE IMPRESION"),
      },
      select: { id: true },
    });
    return NextResponse.json(trabajo, { status: 201 });
  }

  if (body.accion !== "tomar" || !Number.isInteger(Number(body.id)) || !body.estacionId) {
    return NextResponse.json({ error: "Solicitud inválida" }, { status: 400 });
  }

  const configuracion = await prisma.configuracion.findFirst({
    select: { estacionImpresionId: true },
  });
  if (configuracion?.estacionImpresionId !== String(body.estacionId)) {
    return NextResponse.json({ error: "Esta computadora no es la estación principal" }, { status: 409 });
  }

  const resultado = await prisma.impresionTrabajo.updateMany({
    where: { id: Number(body.id), estado: "PENDIENTE" },
    data: {
      estado: "IMPRIMIENDO",
      estacionId: String(body.estacionId),
      claimedAt: new Date(),
      intentos: { increment: 1 },
      error: null,
    },
  });

  if (resultado.count === 0) {
    return NextResponse.json({ error: "El trabajo ya fue tomado" }, { status: 409 });
  }

  const trabajo = await prisma.impresionTrabajo.findUnique({
    where: { id: Number(body.id) },
    select: { id: true, tipo: true, contenido: true, impresora: true },
  });
  return NextResponse.json(trabajo);
}

export async function PUT(req: NextRequest) {
  const body = await req.json();
  if (!Number.isInteger(Number(body.id)) || !body.estacionId) {
    return NextResponse.json({ error: "Solicitud inválida" }, { status: 400 });
  }

  const ok = body.ok === true;
  const trabajo = await prisma.impresionTrabajo.findUnique({
    where: { id: Number(body.id) },
    select: { intentos: true },
  });
  const reintentar = !ok && Boolean(trabajo && trabajo.intentos < 3);
  const resultado = await prisma.impresionTrabajo.updateMany({
    where: {
      id: Number(body.id),
      estado: "IMPRIMIENDO",
      estacionId: String(body.estacionId),
    },
    data: {
      estado: ok ? "IMPRESO" : reintentar ? "PENDIENTE" : "ERROR",
      estacionId: reintentar ? null : undefined,
      claimedAt: reintentar ? null : undefined,
      printedAt: ok ? new Date() : null,
      error: ok ? null : String(body.error || "Error de impresión").slice(0, 500),
    },
  });

  if (resultado.count === 0) {
    return NextResponse.json({ error: "El trabajo no pertenece a esta estación" }, { status: 409 });
  }
  return NextResponse.json({ success: true });
}
