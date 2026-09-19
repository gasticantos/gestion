import { NextRequest, NextResponse } from "next/server";
import { notificarNuevaImpresion } from "@/lib/notificarImpresion";
import { prisma } from "@/lib/prisma";
import { obtenerUsuarioIdDesdeRequest, registrarAuditoria } from "@/lib/auditoria";
import { sesionActual } from "@/lib/sesionServidor";
import { ROL_LABEL } from "@/lib/permisos";
import { formatearFechaHora, formatearMoneda } from "@/lib/formato";
import { aplicarDescuento } from "@/lib/precio";

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const sesion = await sesionActual();
  const { id } = await params;

  try {
    if (!sesion) return NextResponse.json({ error: "No autenticado" }, { status: 401 });
    const body = await req.json().catch(() => ({}));
    const venta = await prisma.venta.findFirst({
      where: { id: Number(id), negocioId: sesion.negocioId },
      include: {
        mesa: true,
        pagos: true,
        pedidos: { include: { items: { include: { producto: true } } } },
      },
    });

    if (!venta) {
      return NextResponse.json({ error: "Venta no encontrada" }, { status: 404 });
    }

    const configuracion = await prisma.configuracion.findUnique({
      where: { negocioId: sesion.negocioId },
    });
    const subtotal = venta.pedidos.reduce(
      (total, pedido) => total + pedido.items.reduce((suma, item) => suma + item.subtotal, 0),
      0
    );
    // En la cuenta previa el descuento todavía no está persistido: usar el valor que
    // está viendo el cajero. En el comprobante final, usar siempre el descuento guardado.
    const descuento = aplicarDescuento(
      subtotal,
      venta.estado === "CERRADA" ? venta.descuentoPct : Number(body.descuentoPct) || 0
    );
    const responsableDescuento = venta.estado === "CERRADA"
      ? venta.descuentoResponsable
      : String(body.descuentoResponsable || "").trim().slice(0, 80) || null;
    const dinero = (valor: number) => `$${formatearMoneda(valor)}`;
    const lineaImporte = (etiqueta: string, valor: number) =>
      `${etiqueta}${dinero(valor).padStart(Math.max(1, 36 - etiqueta.length))}`;
    const lineaDetalle = (cantidad: number, unitario: number, total: number) => {
      const izquierda = `${cantidad} x ${dinero(unitario)}`;
      const derecha = dinero(total);
      return `${izquierda}${derecha.padStart(Math.max(1, 36 - izquierda.length))}`;
    };

    const lineas: string[] = [];
    lineas.push(`[[TITLE]] ${(configuracion?.nombrePrograma || "GESTION").toUpperCase()}`);
    lineas.push(`[[SUBTITLE]] ${venta.estado === "CERRADA" ? "COMPROBANTE DE VENTA" : "CUENTA PREVIA"}`);
    lineas.push("[[HR]]");
    lineas.push(`[[CENTER]] ${venta.mesa?.apodo || venta.mesa?.nombre || "Mostrador"} - Venta #${venta.id}`);
    if (sesion) {
      lineas.push(`[[CENTER]] ${sesion.nombre.toUpperCase()} - ${ROL_LABEL[sesion.rol]}`);
    }
    lineas.push(`[[CENTER]] ${formatearFechaHora(venta.createdAt)}`);
    lineas.push("[[HR]]");
    lineas.push("[[SECTION]] DETALLE DEL PEDIDO");

    // En mesa cada ronda se guarda como un pedido independiente para poder imprimir su
    // comanda en el momento. En el ticket de cobro consolidamos las rondas para no mostrar,
    // por ejemplo, cinco líneas de "Fernet x 1". Si el precio cambió, queda en otra línea.
    const itemsAgrupados = new Map<
      string,
      { nombre: string; cantidad: number; precioUnitario: number; subtotal: number }
    >();
    for (const pedido of venta.pedidos) {
      for (const item of pedido.items) {
        // Productos marcados "No imprimir" (ver /productos) no aparecen en ningún ticket
        // impreso, ni comanda ni comprobante, aunque su importe sigue formando parte del total.
        if (item.producto.impresora?.trim() === "No imprimir") continue;
        const clave = `${item.productoId}:${item.precioUnitario.toFixed(2)}`;
        const existente = itemsAgrupados.get(clave);
        if (existente) {
          existente.cantidad += item.cantidad;
          existente.subtotal += item.subtotal;
        } else {
          itemsAgrupados.set(clave, {
            nombre: item.producto.nombre,
            cantidad: item.cantidad,
            precioUnitario: item.precioUnitario,
            subtotal: item.subtotal,
          });
        }
      }
    }

    for (const item of itemsAgrupados.values()) {
      lineas.push(`[[RECEIPT_ITEM]] ${item.nombre}`);
      lineas.push(`[[DETAIL]] ${lineaDetalle(item.cantidad, item.precioUnitario, item.subtotal)}`);
    }

    lineas.push("[[HR]]");
    lineas.push(`[[ROW]] ${lineaImporte("SUBTOTAL", subtotal)}`);
    if (descuento.monto > 0) {
      lineas.push(`[[ROW]] ${lineaImporte(`DESCUENTO ${descuento.pct}%`, -descuento.monto)}`);
      if (responsableDescuento) lineas.push(`[[NOTE]] Descuento aplicado por: ${responsableDescuento}`);
    }
    if (venta.propina > 0) {
      lineas.push(`[[ROW]] ${lineaImporte("PROPINA", venta.propina)}`);
    }
    lineas.push(`[[TOTAL]] ${lineaImporte("TOTAL FINAL", descuento.total + venta.propina)}`);

    const totalPagado = venta.pagos.reduce((suma, pago) => suma + pago.monto, 0);
    if (totalPagado > 0 && venta.estado !== "CERRADA") {
      lineas.push(`[[ROW]] ${lineaImporte("PAGADO", -totalPagado)}`);
      lineas.push(`[[TOTAL]] ${lineaImporte("SALDO PENDIENTE", Math.max(0, descuento.total - totalPagado))}`);
    }

    if (venta.estado !== "CERRADA" && configuracion?.aliasTransferencia) {
      lineas.push("[[HR]]");
      lineas.push(`[[NOTE]] Alias: ${configuracion.aliasTransferencia}`);
    }

    if (venta.pagos.length > 0) {
      lineas.push("[[HR]]");
      lineas.push(`[[SECTION]] ${venta.estado === "CERRADA" ? "FORMA DE PAGO" : "PAGOS PARCIALES"}`);
    }
    for (const pago of venta.pagos) {
      const metodos: Record<string, string> = {
        EFECTIVO: "Efectivo",
        TARJETA: "Tarjeta",
        TRANSFERENCIA: "Transferencia",
        FIADO: "Cuenta corriente",
      };
      const detalleTarjeta = pago.metodo === "TARJETA"
        ? ` · ${pago.tipoTarjeta === "DEBITO" ? "Débito" : pago.tipoTarjeta === "CREDITO" ? "Crédito" : "QR"}`
        : "";
      lineas.push(`[[ROW]] ${lineaImporte(`${metodos[pago.metodo] || pago.metodo}${detalleTarjeta}`, pago.monto)}`);
    }

    lineas.push("[[HR]]");
    lineas.push("[[FOOTER]] Gracias por su compra");
    lineas.push("");

    const contenido = lineas.join("\n");

    const [trabajo] = await prisma.$transaction([
      prisma.impresionTrabajo.create({
        data: { tipo: "TICKET", contenido, negocioId: sesion.negocioId },
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
    await notificarNuevaImpresion();

    return NextResponse.json({ success: true, encolado: true, trabajoId: trabajo.id });
  } catch (err) {
    console.error("Error:", err);
    return NextResponse.json({ error: "Error al generar ticket" }, { status: 500 });
  }
}
