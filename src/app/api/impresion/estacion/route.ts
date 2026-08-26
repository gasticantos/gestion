import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { sesionActual } from "@/lib/sesionServidor";

export async function GET(req: NextRequest) {
  const estacionId = req.nextUrl.searchParams.get("estacionId")?.trim();
  if (!estacionId) return NextResponse.json({ principal: false });

  const sesion = await sesionActual();
  if (sesion) {
    const configuracion = await prisma.configuracion.findUnique({
      where: { negocioId: sesion.negocioId },
      select: { estacionImpresionId: true },
    });
    return NextResponse.json({
      principal: configuracion?.estacionImpresionId === estacionId,
      configurada: Boolean(configuracion?.estacionImpresionId),
    });
  }

  const configuracion = await prisma.configuracion.findFirst({
    where: { estacionImpresionId: estacionId },
    select: { id: true },
  });
  return NextResponse.json({
    principal: Boolean(configuracion),
    configurada: Boolean(configuracion),
  });
}

export async function PUT(req: NextRequest) {
  const sesion = await sesionActual();
  if (!sesion) return NextResponse.json({ error: "No autenticado" }, { status: 401 });
  if (sesion.rol !== "DUENIO" && sesion.rol !== "CAJERO") {
    return NextResponse.json({ error: "No tenés permiso para cambiar la estación" }, { status: 403 });
  }

  const body = await req.json();
  const estacionId = String(body.estacionId || "").trim();
  if (!estacionId) {
    return NextResponse.json({ error: "Estación inválida" }, { status: 400 });
  }

  const configuracion = await prisma.configuracion.upsert({
    where: { negocioId: sesion.negocioId },
    update: { estacionImpresionId: estacionId },
    create: { negocioId: sesion.negocioId, estacionImpresionId: estacionId },
    select: { estacionImpresionId: true },
  });

  return NextResponse.json({ principal: configuracion.estacionImpresionId === estacionId });
}
