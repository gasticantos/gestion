import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { redondearPrecio } from "@/lib/precio";
import { sesionActual } from "@/lib/sesionServidor";

export async function GET() {
  const sesion = await sesionActual();
  if (!sesion) return NextResponse.json({ error: "No autenticado" }, { status: 401 });
  const promos = await prisma.producto.findMany({
    where: { negocioId: sesion.negocioId, esPromo: true },
    include: { categoria: { select: { id: true, nombre: true } } },
    orderBy: [{ promoDesde: "desc" }, { nombre: "asc" }],
  });
  return NextResponse.json(promos);
}

export async function POST(req: NextRequest) {
  const sesion = await sesionActual();
  if (!sesion) return NextResponse.json({ error: "No autenticado" }, { status: 401 });
  const body = await req.json();
  const desde = new Date(body.promoDesde);
  const hasta = new Date(body.promoHasta);
  if (!String(body.nombre || "").trim() || !Number.isFinite(Number(body.precioVenta))) {
    return NextResponse.json({ error: "Completá nombre y precio de venta" }, { status: 400 });
  }
  if (isNaN(desde.getTime()) || isNaN(hasta.getTime()) || hasta < desde) {
    return NextResponse.json({ error: "La fecha hasta debe ser igual o posterior a la fecha desde" }, { status: 400 });
  }
  try {
    const precioVenta = redondearPrecio(Number(body.precioVenta));
    const promo = await prisma.producto.create({
      data: {
        negocioId: sesion.negocioId,
        esPromo: true,
        promoDesde: desde,
        promoHasta: hasta,
        nombre: String(body.nombre).trim(),
        codigoBarras: body.codigoBarras?.trim() || null,
        categoriaId: body.categoriaId ? Number(body.categoriaId) : null,
        precioCosto: Number(body.precioCosto) || 0,
        precioVenta,
        precioVentaMesa: redondearPrecio(Number(body.precioVentaMesa) || precioVenta),
        precioVentaMesaManual: Boolean(body.precioVentaMesa),
        stock: Number(body.stock) || 0,
        unidad: String(body.unidad || "unidad").trim(),
        impresora: body.impresora?.trim() || null,
        requiereConfirmacion: Boolean(body.requiereConfirmacion),
        activo: body.activo !== false,
      },
    });
    return NextResponse.json(promo, { status: 201 });
  } catch (error: unknown) {
    if (typeof error === "object" && error && "code" in error && error.code === "P2002") {
      return NextResponse.json({ error: "Ya existe un producto con ese código" }, { status: 409 });
    }
    return NextResponse.json({ error: "No se pudo guardar la promoción" }, { status: 500 });
  }
}
