import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { sesionActual } from "@/lib/sesionServidor";

const TAMANO_MAXIMO_IMAGEN = 2_800_000;

export async function GET() {
  const sesion = await sesionActual();
  if (!sesion) return NextResponse.json({ error: "No autenticado" }, { status: 401 });

  const flyers = await prisma.flyer.findMany({
    where: { negocioId: sesion.negocioId },
    select: { id: true, imagen: true, createdAt: true },
    orderBy: { createdAt: "desc" },
  });
  return NextResponse.json(flyers);
}

export async function POST(req: NextRequest) {
  const sesion = await sesionActual();
  if (!sesion) return NextResponse.json({ error: "No autenticado" }, { status: 401 });
  if (sesion.rol !== "DUENIO") {
    return NextResponse.json({ error: "Solo el dueño puede cargar flyers" }, { status: 403 });
  }

  const body = await req.json().catch(() => null);
  const imagen = typeof body?.imagen === "string" ? body.imagen : "";
  if (!imagen.startsWith("data:image/webp;base64,") || imagen.length > TAMANO_MAXIMO_IMAGEN) {
    return NextResponse.json({ error: "La imagen no es válida o es demasiado grande" }, { status: 400 });
  }

  const flyer = await prisma.flyer.create({
    data: { imagen, negocioId: sesion.negocioId },
    select: { id: true, imagen: true, createdAt: true },
  });
  return NextResponse.json(flyer, { status: 201 });
}
