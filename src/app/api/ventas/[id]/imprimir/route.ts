import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { obtenerUsuarioIdDesdeRequest, registrarAuditoria } from "@/lib/auditoria";
import { sesionActual } from "@/lib/sesionServidor";
import { ROL_LABEL } from "@/lib/permisos";
import { formatearMoneda } from "@/lib/formato";

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

    const configuracion = await prisma.configuracion.findFirst();
    const subtotal = venta.pedidos.reduce(
      (total, pedido) => total + pedido.items.reduce((suma, item) => suma + item.subtotal, 0),
      0
    );
    const dinero = (valor: number) => `$${formatearMoneda(valor)}`;
    const lineaImporte = (etiqueta: string, valor: number) =>
      `${etiqueta}${dinero(valor).padStart(Math.max(1, 36 - etiqueta.length))}`;

    // Diseño compacto para papel térmico: pocas divisiones y jerarquía por espacios/títulos.
    const lineas: string[] = [];
    lineas.push((configuracion?.nombrePrograma || "GESTION").toUpperCase());
    lineas.push(venta.estado === "CERRADA" ? "TICKET FINAL" : "CUENTA PREVIA");
    lineas.push("");
    lineas.push(`${venta.mesa?.nombre || "Mostrador"}  |  Venta #${venta.id}`);
    if (sesion) {
      lineas.push(`${sesion.nombre.toUpperCase()} - ${ROL_LABEL[sesion.rol]}`);
    }
    lineas.push(new Date(venta.createdAt).toLocaleString("es-AR"));
    lineas.push("");
    lineas.push("PRODUCTOS");

    for (const pedido of venta.pedidos) {
      for (const item of pedido.items) {
        lineas.push(`${item.cantidad}x ${item.producto.nombre}`);
        lineas.push(`   ${dinero(item.precioUnitario)} c/u     ${dinero(item.subtotal)}`);
      }
    }

    lineas.push("");
    lineas.push(lineaImporte("SUBTOTAL", subtotal));
    if (venta.descuentoPct > 0) {
      const desc = (subtotal * venta.descuentoPct) / 100;
      lineas.push(lineaImporte(`DESCUENTO ${venta.descuentoPct}%`, -desc));
    }
    lineas.push("");
    lineas.push(lineaImporte("TOTAL", venta.total));

    if (venta.estado === "CERRADA") {
      lineas.push("");
      lineas.push("PAGO");
    }
    for (const pago of venta.pagos) {
      const metodos: Record<string, string> = {
        EFECTIVO: "Efectivo",
        TARJETA: "Tarjeta",
        TRANSFERENCIA: "Transferencia",
        FIADO: "Cuenta corriente",
      };
      lineas.push(lineaImporte(metodos[pago.metodo] || pago.metodo, pago.monto));
    }

    lineas.push("");
    lineas.push("Gracias por su compra");
    lineas.push("");

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
