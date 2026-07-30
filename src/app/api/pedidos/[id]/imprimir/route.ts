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

    const configuracion = await prisma.configuracion.findFirst();
    const nombreUsuario = pedido.creadoPor?.nombre || sesion?.nombre || "Usuario";
    const rolUsuario = pedido.creadoPor?.rol || sesion?.rol;
    const itemsPorImpresora = new Map<string, typeof pedido.items>();
    for (const item of pedido.items) {
      const destino = item.producto.impresora?.trim() || "";
      const grupo = itemsPorImpresora.get(destino) || [];
      grupo.push(item);
      itemsPorImpresora.set(destino, grupo);
    }

    const trabajos = Array.from(itemsPorImpresora.entries()).map(([impresora, items]) => {
      const lineas: string[] = [];
      lineas.push(`[[TITLE]] ${(configuracion?.nombrePrograma || "GESTION").toUpperCase()}`);
      lineas.push("[[SUBTITLE]] COMANDA");
      lineas.push("[[HR]]");
      lineas.push(`[[TITLE]] ${(pedido.venta.mesa?.nombre || "Mostrador").toUpperCase()}`);
      lineas.push(
        `[[CENTER]] ${nombreUsuario.toUpperCase()}${rolUsuario ? ` · ${ROL_LABEL[rolUsuario]}` : ""}`
      );
      lineas.push(`[[CENTER]] ${new Date(pedido.createdAt).toLocaleString("es-AR")} · Pedido #${pedido.id}`);
      lineas.push("[[HR]]");
      lineas.push("[[SECTION]] PRODUCTOS");

      for (const item of items) {
        lineas.push(`[[ITEM]] ${item.cantidad} x ${item.producto.nombre}`);
        if (item.notas) {
          lineas.push(`[[NOTE]] NOTA: ${item.notas.toUpperCase()}`);
        }
      }
      lineas.push("[[HR]]");
      lineas.push("[[FOOTER]] Comanda de cocina");
      lineas.push("");

      return prisma.impresionTrabajo.create({
        data: {
          tipo: "COMANDA",
          contenido: lineas.join("\n"),
          impresora: impresora || null,
        },
        select: { id: true },
      });
    });

    const resultado = await prisma.$transaction([
      ...trabajos,
      prisma.pedido.update({
        where: { id: Number(id) },
        data: { comandaImpresa: true },
      }),
    ]);
    const trabajosCreados = resultado.slice(0, trabajos.length);

    return NextResponse.json({
      success: true,
      encolado: true,
      trabajoId: trabajosCreados[0]?.id,
      trabajoIds: trabajosCreados.map((trabajo) => trabajo.id),
    });
  } catch (err) {
    console.error("Error al generar comanda:", err);
    return NextResponse.json({ error: "Error al generar comanda" }, { status: 500 });
  }
}
