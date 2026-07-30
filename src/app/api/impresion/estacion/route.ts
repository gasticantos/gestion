import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET(req: NextRequest) {
  const estacionId = req.nextUrl.searchParams.get("estacionId")?.trim();
  if (!estacionId) return NextResponse.json({ principal: false });

  const configuracion = await prisma.configuracion.findFirst({
    select: { estacionImpresionId: true },
  });
  return NextResponse.json({
    principal: configuracion?.estacionImpresionId === estacionId,
    configurada: Boolean(configuracion?.estacionImpresionId),
  });
}

export async function PUT(req: NextRequest) {
  const body = await req.json();
  const estacionId = String(body.estacionId || "").trim();
  if (!estacionId) {
    return NextResponse.json({ error: "Estación inválida" }, { status: 400 });
  }

  const existente = await prisma.configuracion.findFirst({ select: { id: true } });
  const configuracion = existente
    ? await prisma.configuracion.update({
        where: { id: existente.id },
        data: { estacionImpresionId: estacionId },
        select: { estacionImpresionId: true },
      })
    : await prisma.configuracion.create({
        data: { estacionImpresionId: estacionId },
        select: { estacionImpresionId: true },
      });

  return NextResponse.json({ principal: configuracion.estacionImpresionId === estacionId });
}
