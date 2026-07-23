import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { obtenerUsuarioIdDesdeRequest, registrarAuditoria } from "@/lib/auditoria";

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
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
    lineas.push("TICKET");
    lineas.push("=".repeat(40));
    lineas.push(`Venta #${venta.id}`);
    lineas.push(venta.mesa?.nombre || "Mostrador");
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

    // Marcar ticket como impreso
    await prisma.venta.update({
      where: { id: Number(id) },
      data: { ticketImpreso: true },
    });

    const usuarioId = await obtenerUsuarioIdDesdeRequest(req);
    await registrarAuditoria(usuarioId, "imprimir_ticket", `Venta #${venta.id}`);

    // El servidor (Vercel) no tiene acceso a la impresora física: la impresión real la hace
    // el navegador, ya sea vía el agente local (print-agent) o el diálogo de impresión.
    return NextResponse.json({ success: true, contenido });
  } catch (err) {
    console.error("Error:", err);
    return NextResponse.json({ error: "Error al generar ticket" }, { status: 500 });
  }
}
