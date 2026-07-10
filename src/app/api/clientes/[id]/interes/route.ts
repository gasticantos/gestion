import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const body = await req.json();
  const { monto, notas } = body as { monto: number; notas?: string };

  if (!monto || isNaN(Number(monto)) || Number(monto) <= 0) {
    return NextResponse.json({ error: "El monto debe ser mayor a cero" }, { status: 400 });
  }

  const cliente = await prisma.cliente.findUnique({ where: { id: Number(id) } });
  if (!cliente) {
    return NextResponse.json({ error: "Cliente no encontrado" }, { status: 404 });
  }

  const [movimiento] = await prisma.$transaction([
    prisma.movimientoCuentaCorriente.create({
      data: { clienteId: cliente.id, tipo: "INTERES", monto: Number(monto), notas: notas || null },
    }),
    prisma.cliente.update({ where: { id: cliente.id }, data: { saldo: { increment: Number(monto) } } }),
  ]);

  return NextResponse.json(movimiento, { status: 201 });
}
