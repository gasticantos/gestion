import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { aplicarDescuento } from "@/lib/precio";
import { sesionActual } from "@/lib/sesionServidor";

type ItemEntrada = { productoId?: number; nombre: string; cantidad: number; precioUnitario: number };

export async function GET() {
  const sesion = await sesionActual();
  if (!sesion) return NextResponse.json({ error: "No autenticado" }, { status: 401 });
  const ahora = new Date();
  await prisma.presupuesto.updateMany({
    where: { negocioId: sesion.negocioId, estado: "BORRADOR", validoHasta: { lt: ahora } },
    data: { estado: "VENCIDO" },
  });
  const presupuestos = await prisma.presupuesto.findMany({
    where: { negocioId: sesion.negocioId }, include: { items: true },
    orderBy: { createdAt: "desc" }, take: 200,
  });
  return NextResponse.json(presupuestos);
}

export async function POST(req: NextRequest) {
  const sesion = await sesionActual();
  if (!sesion) return NextResponse.json({ error: "No autenticado" }, { status: 401 });
  const body = await req.json();
  const items = (Array.isArray(body.items) ? body.items : []) as ItemEntrada[];
  const validoHasta = new Date(body.validoHasta);
  if (!String(body.clienteNombre || "").trim() || items.length === 0 || isNaN(validoHasta.getTime())) {
    return NextResponse.json({ error: "Completá el cliente, la validez y al menos un ítem" }, { status: 400 });
  }
  if (items.some((i) => !String(i.nombre || "").trim() || Number(i.cantidad) <= 0 || Number(i.precioUnitario) < 0)) {
    return NextResponse.json({ error: "Revisá los ítems del presupuesto" }, { status: 400 });
  }
  const subtotal = items.reduce((s, i) => s + Number(i.cantidad) * Number(i.precioUnitario), 0);
  const descuento = aplicarDescuento(subtotal, Number(body.descuentoPct) || 0);
  const presupuesto = await prisma.presupuesto.create({
    data: {
      negocioId: sesion.negocioId, clienteNombre: String(body.clienteNombre).trim(),
      clienteTelefono: body.clienteTelefono?.trim() || null, validoHasta,
      descuentoPct: descuento.pct, subtotal, total: descuento.total,
      notas: body.notas?.trim() || null,
      items: { create: items.map((i) => ({
        productoId: i.productoId ? Number(i.productoId) : null, nombre: String(i.nombre).trim(),
        cantidad: Number(i.cantidad), precioUnitario: Number(i.precioUnitario),
        subtotal: Number(i.cantidad) * Number(i.precioUnitario),
      })) },
    }, include: { items: true },
  });
  return NextResponse.json(presupuesto, { status: 201 });
}
