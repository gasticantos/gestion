import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

const FRASE_CONFIRMACION = "BORRAR TODO";

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}));
  const { confirmacion } = body as { confirmacion?: string };

  if (confirmacion !== FRASE_CONFIRMACION) {
    return NextResponse.json(
      { error: `Escribí exactamente "${FRASE_CONFIRMACION}" para confirmar` },
      { status: 400 }
    );
  }

  // Cada deleteMany queda limitado automáticamente al negocio de la sesión.
  await prisma.movimientoCuentaCorriente.deleteMany();
  await prisma.pago.deleteMany();
  await prisma.pedidoItem.deleteMany();
  await prisma.pedido.deleteMany();
  await prisma.venta.deleteMany();
  await prisma.reserva.deleteMany();
  await prisma.stockEntryItem.deleteMany();
  await prisma.stockEntry.deleteMany();
  await prisma.producto.deleteMany();
  await prisma.proveedor.deleteMany();
  await prisma.mesa.deleteMany();
  await prisma.cliente.deleteMany();
  await prisma.categoria.deleteMany();
  await prisma.impresionTrabajo.deleteMany();
  await prisma.flyer.deleteMany();

  return NextResponse.json({ ok: true });
}
