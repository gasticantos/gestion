import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  try {
    const pedido = await prisma.pedido.findUnique({
      where: { id: Number(id) },
      include: {
        items: { include: { producto: true } },
        venta: { include: { mesa: true } },
      },
    });

    if (!pedido) {
      return NextResponse.json({ error: "Pedido no encontrado" }, { status: 404 });
    }

    // Generar contenido de comanda en texto plano para ESC/POS
    const lineas: string[] = [];
    lineas.push("=".repeat(40));
    lineas.push("COMANDA");
    lineas.push("=".repeat(40));
    lineas.push(pedido.venta.mesa?.nombre || "Mostrador");
    lineas.push(new Date(pedido.createdAt).toLocaleString("es-AR"));
    lineas.push("-".repeat(40));

    for (const item of pedido.items) {
      lineas.push(`${item.cantidad}x ${item.producto.nombre}`);
    }

    lineas.push("=".repeat(40));

    const contenido = lineas.join("\n");

    // Marcar comanda como impresa (la impresión real ocurre en el navegador vía /pedidos/[id]/comanda)
    await prisma.pedido.update({
      where: { id: Number(id) },
      data: { comandaImpresa: true },
    });

    // El servidor (Vercel) no tiene acceso a la impresora física: la impresión real la hace
    // el navegador, ya sea vía el agente local (print-agent) o el diálogo de impresión.
    return NextResponse.json({ success: true, contenido });
  } catch (err) {
    console.error("Error al generar comanda:", err);
    return NextResponse.json({ error: "Error al generar comanda" }, { status: 500 });
  }
}
