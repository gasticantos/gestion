import { conBloqueoCaja, ventasPendientesCaja, filtroVentasCajaActual } from "@/lib/cajaManual";
import { notificarNuevaImpresion } from "@/lib/notificarImpresion";
import { formatearFechaHora, formatearMoneda } from "@/lib/formato";
import { obtenerReporteVentas } from "@/lib/reportes";
import { enviarDocumentoTelegram } from "@/lib/telegram";
import { generarPdfCierreCaja } from "@/lib/pdfCierreCaja";
import { codigoCierre } from "@/lib/codigoCierre";

const METODOS = {
  EFECTIVO: "EFECTIVO",
  TARJETA: "TARJETA",
  TRANSFERENCIA: "TRANSFERENCIA",
  FIADO: "CUENTA CORRIENTE",
} as const;

type CierreCajaParams = {
  negocioId: number;
  controlCajaId: number;
  operador: { nombre: string; rol: string };
};

export type ResultadoCierreCaja =
  | { estado: "YA_CERRADO" }
  | { estado: "CAJA_NO_ABIERTA" }
  | { estado: "ARQUEO_PENDIENTE" }
  | { estado: "MESAS_ABIERTAS"; mesasAbiertas: string[] }
  | {
      estado: "CERRADO";
      trabajoId: number;
      codigo: string;
      cantidadVentas: number;
      total: number;
      telegramEnviado: boolean;
      telegramError?: string;
    };

/** Sólo una acción manual cierra la caja indicada, aunque lleve varios días abierta. */
export async function cerrarJornadaCaja({
  negocioId,
  controlCajaId,
  operador,
}: CierreCajaParams): Promise<ResultadoCierreCaja> {
  const preparado = await conBloqueoCaja(negocioId, async (tx) => {
    const controlPendiente = await tx.controlCaja.findFirst({
      where: { negocioId },
      include: { movimientos: true },
      orderBy: { id: "desc" },
    });
    if (!controlPendiente) return { estado: "CAJA_NO_ABIERTA" } as const;
    if (controlPendiente.id !== controlCajaId) {
      const anterior = await tx.controlCaja.findFirst({ where: { id: controlCajaId, negocioId }, select: { cerradoAt: true } });
      return anterior?.cerradoAt ? { estado: "YA_CERRADO" } as const : { estado: "CAJA_NO_ABIERTA" } as const;
    }
    if (controlPendiente.cerradoAt) return { estado: "YA_CERRADO" } as const;
    if (controlPendiente.efectivoContado == null || controlPendiente.saldoSiguiente == null) {
      return { estado: "ARQUEO_PENDIENTE" } as const;
    }
    const mesasAbiertas = await tx.mesa.findMany({
      where: { negocioId, ventas: { some: { estado: "ABIERTA", total: { gt: 0 } } } },
      select: { nombre: true, apodo: true },
      orderBy: { numero: "asc" },
    });
    if (mesasAbiertas.length) {
      return { estado: "MESAS_ABIERTAS", mesasAbiertas: mesasAbiertas.map(m => m.apodo || m.nombre) } as const;
    }
    const fecha = controlPendiente.fechaJornada;
    const hasta = new Date();
    const ventas = await tx.venta.findMany({
      where: await filtroVentasCajaActual(negocioId, tx),
      select: { id: true },
      orderBy: { id: "asc" },
    });
    const ventaIds = ventas.map(v => v.id);
    const referencia = `cierre-caja:${fecha}:control:${controlPendiente.id}`;
    const codigo = codigoCierre(fecha, controlPendiente.id);
    const reporte = await obtenerReporteVentas(controlPendiente.createdAt, hasta, {
        limiteProductos: null, negocioId, etiquetaDesde: fecha, etiquetaHasta: fecha,
        soloPendientesCierre: true, ventaIds,
      }, tx);
    const configuracion = await tx.configuracion.findUnique({ where: { negocioId }, select: { nombrePrograma: true } });
    const dinero = (valor: number) => `$${formatearMoneda(valor)}`;
    const fila = (nombre: string, valor: number) =>
      `${nombre}${dinero(valor).padStart(Math.max(1, 32 - nombre.length))}`;
    const lineas = [
      `[[TITLE]] ${(configuracion?.nombrePrograma || "GESTION").toUpperCase()}`,
      "[[SUBTITLE]] CIERRE DE CAJA",
      "[[HR]]",
      `[[HERO]] ${codigo}`,
      "[[CENTER]] IDENTIFICADOR DEL CIERRE",
      "[[HR]]",
      `[[CENTER]] ${formatearFechaHora(new Date())}`,
      `[[CENTER]] ${operador.nombre.toUpperCase()} - ${operador.rol}`,
      "[[HR]]",
      `[[ROW]] CAJA: #${controlPendiente.id}`,
      `[[ROW]] APERTURA: ${formatearFechaHora(controlPendiente.createdAt)}`,
      "[[SECTION]] RESUMEN DEL TURNO",
      `[[ROW]] VENTAS REALIZADAS: ${reporte.cantidadVentas}`,
      `[[ROW]] ${fila("MOSTRADOR", reporte.porCanal.MOSTRADOR.total)}`,
      `[[ROW]] ${fila("MESAS", reporte.porCanal.MESA.total)}`,
      `[[TOTAL]] ${fila("TOTAL VENDIDO", reporte.combinado.total)}`,
      "[[HR]]",
      "[[SECTION]] MEDIOS DE PAGO",
    ];
    for (const metodo of Object.keys(METODOS) as (keyof typeof METODOS)[]) {
      lineas.push(`[[ROW]] ${fila(METODOS[metodo], reporte.combinado.pagos[metodo])}`);
    }
    lineas.push(`[[ROW]] ${fila("TARJETA QR", reporte.combinado.tarjetas.QR)}`);
    lineas.push(`[[ROW]] ${fila("TARJETA DEBITO", reporte.combinado.tarjetas.DEBITO)}`);
    lineas.push(`[[ROW]] ${fila("TARJETA CREDITO", reporte.combinado.tarjetas.CREDITO)}`);
    lineas.push(`[[ROW]] ${fila("PROPINA", reporte.combinado.propina)}`);
    const ingresosCaja = controlPendiente?.movimientos
      .filter((movimiento) => movimiento.tipo === "INGRESO")
      .reduce((total, movimiento) => total + movimiento.monto, 0) ?? 0;
    const egresosCaja = controlPendiente?.movimientos
      .filter((movimiento) => movimiento.tipo === "EGRESO")
      .reduce((total, movimiento) => total + movimiento.monto, 0) ?? 0;
    const efectivoEsperado = controlPendiente
      ? controlPendiente.saldoInicial + reporte.combinado.pagos.EFECTIVO + ingresosCaja - egresosCaja
      : 0;
    const diferencia =
      controlPendiente?.efectivoContado == null ? null : controlPendiente.efectivoContado - efectivoEsperado;
    const saldoSiguiente = controlPendiente?.saldoSiguiente ?? efectivoEsperado;
    const resumenControl = controlPendiente
      ? {
          saldoInicial: controlPendiente.saldoInicial,
          ventasEfectivo: reporte.combinado.pagos.EFECTIVO,
          ingresos: ingresosCaja,
          egresos: egresosCaja,
          efectivoEsperado,
          efectivoContado: controlPendiente.efectivoContado,
          diferencia,
          saldoSiguiente,
        }
      : null;
    if (resumenControl) {
      lineas.push(
        "[[HR]]",
        "[[SECTION]] CONTROL DE EFECTIVO",
        `[[ROW]] ${fila("EFECTIVO INICIAL", resumenControl.saldoInicial)}`,
        `[[ROW]] ${fila("VENTAS EFECTIVO", resumenControl.ventasEfectivo)}`,
        `[[ROW]] ${fila("OTROS INGRESOS", resumenControl.ingresos)}`,
        `[[ROW]] ${fila("EGRESOS", -resumenControl.egresos)}`,
        `[[TOTAL]] ${fila("EFECTIVO ESPERADO", resumenControl.efectivoEsperado)}`,
        ...(resumenControl.efectivoContado == null
          ? []
          : [
              `[[ROW]] ${fila("EFECTIVO CONTADO", resumenControl.efectivoContado)}`,
              `[[ROW]] ${fila("DIFERENCIA", resumenControl.diferencia ?? 0)}`,
            ]),
        `[[ROW]] ${fila("INICIO PROXIMA JORNADA", resumenControl.saldoSiguiente)}`
      );
    }
    lineas.push("[[HR]]", "[[FOOTER]] Fin del cierre de caja", "");

    const trabajo = await tx.impresionTrabajo.create({
      data: { tipo: "TICKET", contenido: lineas.join("\n"), impresora: null, referencia, negocioId },
      select: { id: true },
    });
    // Archivar exactamente lo incluido en el comprobante. Nunca mover closedAt,
    // ni incluir una venta cobrada después de la lectura del turno.
    const archivadas = await tx.venta.updateMany({
      where: { ...ventasPendientesCaja(negocioId), id: { in: ventaIds } },
      data: { cierreCajaAt: hasta },
    });
    if (archivadas.count !== ventaIds.length) throw new Error("Las ventas cambiaron durante el cierre. Volvé a intentar.");
    await tx.controlCaja.update({
      where: { id: controlPendiente.id }, data: { cerradoAt: hasta },
    });
    // La siguiente caja se abre únicamente con el botón Iniciar caja.
    return { estado: "PREPARADO", trabajo, reporte, configuracion, resumenControl, fecha, codigo } as const;
  });
  if (preparado.estado !== "PREPARADO") return preparado;
  const { trabajo, reporte, configuracion, resumenControl, fecha, codigo } = preparado;
  try {
    await notificarNuevaImpresion();
    let telegramEnviado = false;
    let telegramError: string | undefined;
    try {
      const pdf = generarPdfCierreCaja({
        nombreNegocio: configuracion?.nombrePrograma || "Gestión",
        fechaJornada: fecha,
        codigoCierre: codigo,
        operador,
        reporte,
        controlCaja: resumenControl,
      });
      const envioTelegram = await enviarDocumentoTelegram(
        pdf,
        `cierre-${codigo}.pdf`,
        `Cierre de caja ${codigo} · ${fecha}\n${reporte.cantidadVentas} ventas · $${formatearMoneda(reporte.combinado.total)}`
      );
      telegramEnviado = envioTelegram.ok;
      if (!envioTelegram.ok) telegramError = envioTelegram.error;
    } catch (error) {
      console.error("No se pudo generar o enviar el PDF del cierre:", error);
      telegramError = error instanceof Error ? error.message : "No se pudo generar el PDF";
    }
    return {
      estado: "CERRADO",
      trabajoId: trabajo.id,
      codigo,
      cantidadVentas: reporte.cantidadVentas,
      total: reporte.combinado.total,
      telegramEnviado,
      ...(telegramError ? { telegramError } : {}),
    };
  } catch (error) {
    console.error("El cierre quedó guardado pero falló su notificación:", error);
    return {
      estado: "CERRADO", trabajoId: trabajo.id, codigo, cantidadVentas: reporte.cantidadVentas,
      total: reporte.combinado.total, telegramEnviado: false,
      telegramError: "El cierre está guardado. Reenviá el PDF desde el historial.",
    };
  }
}
