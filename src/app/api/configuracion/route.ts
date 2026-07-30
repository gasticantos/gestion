import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { sesionActual } from "@/lib/sesionServidor";

export async function GET() {
  const sesion = await sesionActual();
  if (!sesion) return NextResponse.json({ error: "No autenticado" }, { status: 401 });
  const config = await prisma.configuracion.upsert({
    where: { negocioId: sesion.negocioId },
    update: {},
    create: {
      negocioId: sesion.negocioId,
      margenVentaBasePct: 30,
      nombrePrograma: "Gestión",
      precioMesaActivo: true,
      recargoMesaPct: 0,
    },
  });
  return NextResponse.json(config);
}

export async function PUT(req: NextRequest) {
  const sesion = await sesionActual();
  if (!sesion) return NextResponse.json({ error: "No autenticado" }, { status: 401 });
  if (sesion.rol !== "DUENIO") {
    return NextResponse.json({ error: "No tenés permiso para modificar la configuración" }, { status: 403 });
  }
  const body = await req.json();
  const { margenVentaBasePct, nombrePrograma, logoPrograma, precioMesaActivo, recargoMesaPct } = body as {
    margenVentaBasePct: number;
    nombrePrograma: string;
    logoPrograma: string | null;
    precioMesaActivo: boolean;
    recargoMesaPct: number;
  };

  if (recargoMesaPct === undefined || isNaN(Number(recargoMesaPct)) || Number(recargoMesaPct) < 0) {
    return NextResponse.json({ error: "El recargo debe ser un número mayor o igual a cero" }, { status: 400 });
  }
  if (
    margenVentaBasePct === undefined ||
    !Number.isFinite(Number(margenVentaBasePct)) ||
    Number(margenVentaBasePct) < 0
  ) {
    return NextResponse.json({ error: "El margen base debe ser un número mayor o igual a cero" }, { status: 400 });
  }
  const nombreLimpio = String(nombrePrograma || "").trim();
  if (!nombreLimpio || nombreLimpio.length > 50) {
    return NextResponse.json({ error: "El nombre debe tener entre 1 y 50 caracteres" }, { status: 400 });
  }
  if (
    logoPrograma &&
    (!logoPrograma.startsWith("data:image/") || logoPrograma.length > 500_000)
  ) {
    return NextResponse.json({ error: "El logo no es válido o es demasiado grande" }, { status: 400 });
  }

  const config = await prisma.configuracion.upsert({
    where: { negocioId: sesion.negocioId },
    update: {
      margenVentaBasePct: Number(margenVentaBasePct),
      nombrePrograma: nombreLimpio,
      logoPrograma: logoPrograma || null,
      precioMesaActivo: precioMesaActivo !== false,
      recargoMesaPct: Number(recargoMesaPct),
    },
    create: {
      negocioId: sesion.negocioId,
      margenVentaBasePct: Number(margenVentaBasePct),
      nombrePrograma: nombreLimpio,
      logoPrograma: logoPrograma || null,
      precioMesaActivo: precioMesaActivo !== false,
      recargoMesaPct: Number(recargoMesaPct),
    },
  });

  // Recalcular precioVentaMesa de todos los productos que NO fueron fijados a mano.
  // Los fijados manualmente (precioVentaMesaManual = true) quedan tal cual el usuario los dejó.
  await prisma.$executeRaw`
    UPDATE "Producto"
    SET "precioVentaMesa" = CEIL(("precioVenta" + "precioCosto" * ${Number(recargoMesaPct)} / 100) / 100) * 100
    WHERE "precioVentaMesaManual" = false
      AND "negocioId" = ${sesion.negocioId}
  `;

  return NextResponse.json(config);
}
