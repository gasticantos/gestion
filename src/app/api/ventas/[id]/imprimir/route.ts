import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { obtenerUsuarioIdDesdeRequest, registrarAuditoria } from "@/lib/auditoria";
import { sesionActual } from "@/lib/sesionServidor";
import { ROL_LABEL } from "@/lib/permisos";

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const sesion = await sesionActual();
  const { id } = await params;

  try {
    const venta = await prisma.venta.findUnique({
      where: { id: Number(id) },
      include: {
        mesa: true,
        pagos: true,
        pedidos: { include: { items: { include: { producto: true } } } },
      },
    });

    if (!venta) {
      return NextResponse.json({ error: "Venta no encontrada" }, { status: 404 });
    }

    // Generar contenido de ticket en texto plano
    const lineas: string[] = [];
    lineas.push("=".repeat(40));
    lineas.push(venta.estado === "CERRADA" ? "TICKET FINAL" : "CUENTA PREVIA");
    lineas.push("=".repeat(40));
    lineas.push(`Venta #${venta.id}`);
    lineas.push(venta.mesa?.nombre || "Mostrador");
    if (sesion) {
      lineas.push(`Usuario: ${sesion.nombre.toUpperCase()} - ${ROL_LABEL[sesion.rol]}`);
    }
    lineas.push(new Date(venta.createdAt).toLocaleString("es-AR"));
    lineas.push("-".repeat(40));

    for (const pedido of venta.pedidos) {
      for (const item of pedido.items) {
        lineas.push(`${item.cantidad}x ${item.producto.nombre}`);
        lineas.push(`  $${(item.subtotal / item.cantidad).toFixed(2)} = $${item.subtotal.toFixed(2)}`);
      }
    }

    lineas.push("-".repeat(40));
    lineas.push(`Subtotal: $${venta.pedidos.reduce((acc, p) => acc + p.items.reduce((a, i) => a + i.subtotal, 0), 0).toFixed(2)}`);
    if (venta.descuentoPct > 0) {
      const desc = (venta.pedidos.reduce((acc, p) => acc + p.items.reduce((a, i) => a + i.subtotal, 0), 0) * venta.descuentoPct) / 100;
      lineas.push(`Descuento (${venta.descuentoPct}%): -$${desc.toFixed(2)}`);
    }
    lineas.push(`Total: $${venta.total.toFixed(2)}`);
    lineas.push("-".repeat(40));

    if (venta.estado === "CERRADA") {
      lineas.push("FORMA DE PAGO");
    }
    for (const pago of venta.pagos) {
      const metodos: Record<string, string> = {
        EFECTIVO: "Efectivo",
        TARJETA: "Tarjeta",
        TRANSFERENCIA: "Transferencia",
        FIADO: "Cuenta corriente",
      };
      lineas.push(`${metodos[pago.metodo] || pago.metodo}: $${pago.monto.toFixed(2)}`);
    }

    lineas.push("=".repeat(40));
    lineas.push(new Date().toLocaleString("es-AR"));
    lineas.push("=".repeat(40));

    const contenido = lineas.join("\n");

    const [trabajo] = await prisma.$transaction([
      prisma.impresionTrabajo.create({
        data: { tipo: "TICKET", contenido },
        select: { id: true },
      }),
      // Conservamos este indicador como "ticket enviado a impresión". El resultado físico
      // queda registrado de forma separada en ImpresionTrabajo.
      prisma.venta.update({
        where: { id: Number(id) },
        data: { ticketImpreso: true },
      }),
    ]);

    const usuarioId = await obtenerUsuarioIdDesdeRequest(req);
    await registrarAuditoria(usuarioId, "imprimir_ticket", `Venta #${venta.id}`);

    return NextResponse.json({ success: true, encolado: true, trabajoId: trabajo.id });
  } catch (err) {
    console.error("Error:", err);
    return NextResponse.json({ error: "Error al generar ticket" }, { status: 500 });
  }
}
