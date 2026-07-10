import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

function efecto(tipo: string, monto: number) {
  // CARGO e INTERES aumentan lo que debe el cliente; PAGO lo reduce.
  return tipo === "PAGO" ? -monto : monto;
}

export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string; movId: string }> }) {
  const { id, movId } = await params;
  const body = await req.json();
  const { tipo, monto, metodo, notas } = body as {
    tipo: "CARGO" | "PAGO" | "INTERES";
    monto: number;
    metodo?: "EFECTIVO" | "TARJETA" | "TRANSFERENCIA" | null;
    notas?: string | null;
  };

  if (!monto || isNaN(Number(monto)) || Number(monto) <= 0) {
    return NextResponse.json({ error: "El monto debe ser mayor a cero" }, { status: 400 });
  }

  const existente = await prisma.movimientoCuentaCorriente.findUnique({ where: { id: Number(movId) } });
  if (!existente || existente.clienteId !== Number(id)) {
    return NextResponse.json({ error: "Movimiento no encontrado" }, { status: 404 });
  }

  const delta = efecto(tipo, Number(monto)) - efecto(existente.tipo, existente.monto);

  const [movimiento] = await prisma.$transaction([
    prisma.movimientoCuentaCorriente.update({
      where: { id: existente.id },
      data: { tipo, monto: Number(monto), metodo: tipo === "PAGO" ? metodo || null : null, notas: notas || null },
    }),
    prisma.cliente.update({ where: { id: Number(id) }, data: { saldo: { increment: delta } } }),
  ]);

  return NextResponse.json(movimiento);
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string; movId: string }> }) {
  const { id, movId } = await params;

  const existente = await prisma.movimientoCuentaCorriente.findUnique({ where: { id: Number(movId) } });
  if (!existente || existente.clienteId !== Number(id)) {
    return NextResponse.json({ error: "Movimiento no encontrado" }, { status: 404 });
  }

  const reverso = -efecto(existente.tipo, existente.monto);

  await prisma.$transaction([
    prisma.movimientoCuentaCorriente.delete({ where: { id: existente.id } }),
    prisma.cliente.update({ where: { id: Number(id) }, data: { saldo: { increment: reverso } } }),
  ]);

  return NextResponse.json({ ok: true });
}
