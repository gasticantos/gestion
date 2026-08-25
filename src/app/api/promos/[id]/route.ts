import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { redondearPrecio } from "@/lib/precio";
import { sesionActual } from "@/lib/sesionServidor";

export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const sesion = await sesionActual();
  if (!sesion) return NextResponse.json({ error: "No autenticado" }, { status: 401 });
  const { id } = await params;
  const actual = await prisma.producto.findFirst({ where: { id: Number(id), negocioId: sesion.negocioId, esPromo: true } });
  if (!actual) return NextResponse.json({ error: "Promoción no encontrada" }, { status: 404 });
  const body = await req.json();
  const desde = new Date(body.promoDesde);
  const hasta = new Date(body.promoHasta);
  if (!String(body.nombre || "").trim() || !Number.isFinite(Number(body.precioVenta)) || isNaN(desde.getTime()) || isNaN(hasta.getTime()) || hasta < desde) {
    return NextResponse.json({ error: "Revisá el nombre, los precios y las fechas" }, { status: 400 });
  }
  const precioVenta = redondearPrecio(Number(body.precioVenta));
  const promo = await prisma.producto.update({
    where: { id: actual.id },
    data: {
      nombre: String(body.nombre).trim(), codigoBarras: body.codigoBarras?.trim() || null,
      categoriaId: body.categoriaId ? Number(body.categoriaId) : null,
      precioCosto: Number(body.precioCosto) || 0, precioVenta,
      precioVentaMesa: redondearPrecio(Number(body.precioVentaMesa) || precioVenta),
      precioVentaMesaManual: Boolean(body.precioVentaMesa), stock: Number(body.stock) || 0,
      unidad: String(body.unidad || "unidad").trim(), impresora: body.impresora?.trim() || null,
      requiereConfirmacion: Boolean(body.requiereConfirmacion), promoDesde: desde, promoHasta: hasta,
      activo: body.activo !== false,
    },
  });
  return NextResponse.json(promo);
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const sesion = await sesionActual();
  if (!sesion) return NextResponse.json({ error: "No autenticado" }, { status: 401 });
  const { id } = await params;
  const promo = await prisma.producto.findFirst({ where: { id: Number(id), negocioId: sesion.negocioId, esPromo: true } });
  if (!promo) return NextResponse.json({ error: "Promoción no encontrada" }, { status: 404 });
  await prisma.producto.update({ where: { id: promo.id }, data: { activo: false } });
  return NextResponse.json({ ok: true });
}
