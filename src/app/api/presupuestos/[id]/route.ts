import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { sesionActual } from "@/lib/sesionServidor";

const estados = ["BORRADOR", "ACEPTADO", "CANCELADO"] as const;

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const sesion = await sesionActual();
  if (!sesion) return NextResponse.json({ error: "No autenticado" }, { status: 401 });
  const { id } = await params;
  const actual = await prisma.presupuesto.findFirst({ where: { id: Number(id), negocioId: sesion.negocioId } });
  if (!actual) return NextResponse.json({ error: "Presupuesto no encontrado" }, { status: 404 });
  const body = await req.json();
  if (!estados.includes(body.estado)) return NextResponse.json({ error: "Estado inválido" }, { status: 400 });
  return NextResponse.json(await prisma.presupuesto.update({ where: { id: actual.id }, data: { estado: body.estado } }));
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const sesion = await sesionActual();
  if (!sesion) return NextResponse.json({ error: "No autenticado" }, { status: 401 });
  const { id } = await params;
  const actual = await prisma.presupuesto.findFirst({ where: { id: Number(id), negocioId: sesion.negocioId } });
  if (!actual) return NextResponse.json({ error: "Presupuesto no encontrado" }, { status: 404 });
  await prisma.presupuesto.delete({ where: { id: actual.id } });
  return NextResponse.json({ ok: true });
}
