import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

const FRASE_CONFIRMACION = "BORRAR TODO";

// Tablas de datos del negocio. Deliberadamente NO incluye Usuario ni Configuracion:
// este reset es para volver a probar/cargar datos desde cero sin perder el login.
const TABLAS = [
  "MovimientoCuentaCorriente",
  "Pago",
  "PedidoItem",
  "Pedido",
  "Venta",
  "Reserva",
  "StockEntryItem",
  "StockEntry",
  "Producto",
  "Proveedor",
  "Mesa",
  "Cliente",
  "Categoria",
];

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}));
  const { confirmacion } = body as { confirmacion?: string };

  if (confirmacion !== FRASE_CONFIRMACION) {
    return NextResponse.json(
      { error: `Escribí exactamente "${FRASE_CONFIRMACION}" para confirmar` },
      { status: 400 }
    );
  }

  const lista = TABLAS.map((t) => `"${t}"`).join(", ");
  await prisma.$executeRawUnsafe(`TRUNCATE ${lista} RESTART IDENTITY CASCADE`);

  return NextResponse.json({ ok: true });
}
