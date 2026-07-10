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

    // Intentar imprimir via ESC/POS
    try {
      const { USB } = require("escpos");
      const device = new USB();
      const { Printer } = require("escpos");
      const printer = new Printer(device);

      device.open(async () => {
        printer.font("a").style("normal").size(0, 0);
        printer.text(contenido);
        printer.cut();
        printer.close();
      });

      return NextResponse.json({ success: true, message: "Imprimiendo..." });
    } catch (printErr) {
      console.error("Error de impresión ESC/POS:", printErr);
      return NextResponse.json({ error: "No se pudo conectar a impresora" }, { status: 500 });
    }
  } catch (err) {
    console.error("Error al generar comanda:", err);
    return NextResponse.json({ error: "Error al generar comanda" }, { status: 500 });
  }
}
