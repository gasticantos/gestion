import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { sesionActual } from "@/lib/sesionServidor";
import { ROL_LABEL } from "@/lib/permisos";

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const sesion = await sesionActual();
  const { id } = await params;

  try {
    const pedido = await prisma.pedido.findUnique({
      where: { id: Number(id) },
      include: {
        items: { include: { producto: true } },
        venta: { include: { mesa: true } },
        creadoPor: { select: { nombre: true, rol: true } },
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
    const nombreUsuario = pedido.creadoPor?.nombre || sesion?.nombre || "Usuario";
    const rolUsuario = pedido.creadoPor?.rol || sesion?.rol;
    lineas.push(
      `Usuario: ${nombreUsuario.toUpperCase()}${rolUsuario ? ` - ${ROL_LABEL[rolUsuario]}` : ""}`
    );
    lineas.push(new Date(pedido.createdAt).toLocaleString("es-AR"));
    lineas.push("-".repeat(40));

    for (const item of pedido.items) {
      lineas.push(`${item.cantidad}x ${item.producto.nombre}`);
    }

    lineas.push("=".repeat(40));

    const contenido = lineas.join("\n");

    const [trabajo] = await prisma.$transaction([
      prisma.impresionTrabajo.create({
        data: { tipo: "COMANDA", contenido },
        select: { id: true },
      }),
      prisma.pedido.update({
        where: { id: Number(id) },
        data: { comandaImpresa: true },
      }),
    ]);

    return NextResponse.json({ success: true, encolado: true, trabajoId: trabajo.id });
  } catch (err) {
    console.error("Error al generar comanda:", err);
    return NextResponse.json({ error: "Error al generar comanda" }, { status: 500 });
  }
}
