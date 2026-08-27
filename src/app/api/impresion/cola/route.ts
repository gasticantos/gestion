import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { sesionActual } from "@/lib/sesionServidor";
import { notificarNuevaImpresion } from "@/lib/notificarImpresion";

const ultimaRecuperacion = new Map<number, number>();

type TrabajoTomado = {
  id: number;
  tipo: "TICKET" | "COMANDA" | "PRUEBA";
  contenido: string;
  impresora: string | null;
};

async function negocioDeEstacion(estacionId: string) {
  if (!estacionId) return null;
  const configuracion = await prisma.configuracion.findFirst({
    where: { estacionImpresionId: estacionId },
    select: { negocioId: true },
  });
  return configuracion?.negocioId ?? null;
}

// La estación consulta esta ruta periódicamente. Los trabajos que quedaron tomados por
// una estación cerrada vuelven a estar disponibles después de dos minutos.
export async function GET(req: NextRequest) {
  const estacionId = req.nextUrl.searchParams.get("estacionId")?.trim();
  const negocioId = await negocioDeEstacion(estacionId || "");
  if (!estacionId || !negocioId) {
    return NextResponse.json({ trabajos: [] });
  }

  const siguiente = req.nextUrl.searchParams.get("siguiente") === "1";
  if (!siguiente) {
    const sesion = await sesionActual();
    if (!sesion || sesion.negocioId !== negocioId) {
      return NextResponse.json({ error: "No autorizado" }, { status: 401 });
    }
    if (sesion.rol !== "DUENIO" && sesion.rol !== "CAJERO") {
      return NextResponse.json({ error: "No tenés permiso para consultar la cola" }, { status: 403 });
    }
  }
  const limite = siguiente ? 1 : 20;
  const impresorasDisponibles = req.nextUrl.searchParams
    .getAll("impresora")
    .map((nombre) => nombre.trim())
    .filter(Boolean);
  const ahora = Date.now();
  if (ahora - (ultimaRecuperacion.get(negocioId) || 0) > 30_000) {
    ultimaRecuperacion.set(negocioId, ahora);
    const haceDosMinutos = new Date(ahora - 2 * 60 * 1000);
    await prisma.impresionTrabajo.updateMany({
      where: { negocioId, estado: "IMPRIMIENDO", claimedAt: { lt: haceDosMinutos } },
      data: { estado: "PENDIENTE", estacionId: null, claimedAt: null },
    });
  }

  if (siguiente) {
    // Un único viaje a PostgreSQL encuentra, bloquea y devuelve el trabajo. SKIP LOCKED
    // conserva la seguridad si dos pedidos llegan juntos o se reconecta otra instancia.
    const trabajos = await prisma.$queryRaw<TrabajoTomado[]>`
      WITH candidato AS (
        SELECT id
        FROM "ImpresionTrabajo"
        WHERE "negocioId" = ${negocioId}
          AND estado = 'PENDIENTE'::"EstadoImpresion"
          AND (
            impresora IS NULL
            OR (cardinality(${impresorasDisponibles}::text[]) > 0 AND impresora = ANY(${impresorasDisponibles}::text[]))
          )
        ORDER BY "createdAt" ASC
        FOR UPDATE SKIP LOCKED
        LIMIT 1
      )
      UPDATE "ImpresionTrabajo" AS trabajo
      SET estado = 'IMPRIMIENDO'::"EstadoImpresion",
          "estacionId" = ${estacionId},
          "claimedAt" = NOW(),
          intentos = trabajo.intentos + 1,
          error = NULL
      FROM candidato
      WHERE trabajo.id = candidato.id
      RETURNING trabajo.id, trabajo.tipo, trabajo.contenido, trabajo.impresora
    `;
    return NextResponse.json({ trabajos });
  }

  const trabajos = await prisma.impresionTrabajo.findMany({
    where: { negocioId },
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
    const sesion = await sesionActual();
    if (!sesion) return NextResponse.json({ error: "No autenticado" }, { status: 401 });
    if (sesion.rol !== "DUENIO" && sesion.rol !== "CAJERO") {
      return NextResponse.json({ error: "No tenés permiso para imprimir una prueba" }, { status: 403 });
    }
    const trabajo = await prisma.impresionTrabajo.create({
      data: {
        tipo: "PRUEBA",
        contenido: String(body.contenido || "PRUEBA DE IMPRESION"),
        negocioId: sesion.negocioId,
      },
      select: { id: true },
    });
    await notificarNuevaImpresion();
    return NextResponse.json(trabajo, { status: 201 });
  }

  if (body.accion !== "tomar" || !Number.isInteger(Number(body.id)) || !body.estacionId) {
    return NextResponse.json({ error: "Solicitud inválida" }, { status: 400 });
  }

  const estacionId = String(body.estacionId);
  const negocioId = await negocioDeEstacion(estacionId);
  if (!negocioId) {
    return NextResponse.json({ error: "Esta computadora no es la estación principal" }, { status: 409 });
  }

  const resultado = await prisma.impresionTrabajo.updateMany({
    where: { id: Number(body.id), negocioId, estado: "PENDIENTE" },
    data: {
      estado: "IMPRIMIENDO",
      estacionId,
      claimedAt: new Date(),
      intentos: { increment: 1 },
      error: null,
    },
  });

  if (resultado.count === 0) {
    return NextResponse.json({ error: "El trabajo ya fue tomado" }, { status: 409 });
  }

  const trabajo = await prisma.impresionTrabajo.findFirst({
    where: { id: Number(body.id), negocioId },
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
  const estacionId = String(body.estacionId);
  const negocioId = await negocioDeEstacion(estacionId);
  if (!negocioId) {
    return NextResponse.json({ error: "Esta computadora no es la estación principal" }, { status: 409 });
  }
  const trabajo = await prisma.impresionTrabajo.findFirst({
    where: { id: Number(body.id), negocioId },
    select: { intentos: true },
  });
  const reintentar = !ok && Boolean(trabajo && trabajo.intentos < 3);
  const resultado = await prisma.impresionTrabajo.updateMany({
    where: {
      id: Number(body.id),
      negocioId,
      estado: "IMPRIMIENDO",
      estacionId,
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
