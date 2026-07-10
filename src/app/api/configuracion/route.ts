import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET() {
  const config = await prisma.configuracion.upsert({
    where: { id: 1 },
    update: {},
    create: { id: 1, recargoMesaPct: 0 },
  });
  return NextResponse.json(config);
}

export async function PUT(req: NextRequest) {
  const body = await req.json();
  const { recargoMesaPct } = body as { recargoMesaPct: number };

  if (recargoMesaPct === undefined || isNaN(Number(recargoMesaPct)) || Number(recargoMesaPct) < 0) {
    return NextResponse.json({ error: "El recargo debe ser un número mayor o igual a cero" }, { status: 400 });
  }

  const config = await prisma.configuracion.upsert({
    where: { id: 1 },
    update: { recargoMesaPct: Number(recargoMesaPct) },
    create: { id: 1, recargoMesaPct: Number(recargoMesaPct) },
  });
  return NextResponse.json(config);
}
