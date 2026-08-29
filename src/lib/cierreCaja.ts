import { prisma } from "@/lib/prisma";
import { notificarNuevaImpresion } from "@/lib/notificarImpresion";
import { fechaArgentinaYMD, formatearFechaHora, formatearMoneda } from "@/lib/formato";
import { obtenerReporteVentas } from "@/lib/reportes";
import { enviarAlertaTelegram, enviarDocumentoTelegram } from "@/lib/telegram";
import { generarPdfCierreCaja } from "@/lib/pdfCierreCaja";

const METODOS = {
  EFECTIVO: "EFECTIVO",
  TARJETA: "TARJETA",
  TRANSFERENCIA: "TRANSFERENCIA",
  FIADO: "CUENTA CORRIENTE",
} as const;

type CierreCajaParams = {
  negocioId: number;
  fecha: string;
  desde: Date;
  hasta: Date;
  operador: { nombre: string; rol: string };
};

export type ResultadoCierreCaja =
  | { estado: "YA_CERRADO" }
  | { estado: "SIN_VENTAS" }
  | { estado: "MESAS_ABIERTAS"; mesasAbiertas: string[] }
  | {
      estado: "CERRADO";
      trabajoId: number;
      cantidadVentas: number;
      total: number;
      telegramEnviado: boolean;
      telegramError?: string;
    };

/** Cierra una jornada una sola vez. La referencia única evita duplicados manuales o automáticos. */
export async function cerrarJornadaCaja({
  negocioId,
  fecha,
  desde,
  hasta,
  operador,
}: CierreCajaParams): Promise<ResultadoCierreCaja> {
  const mesasAbiertas = await prisma.mesa.findMany({
    where: {
      negocioId,
      ventas: { some: { estado: "ABIERTA", total: { gt: 0 } } },
    },
    select: { nombre: true, apodo: true },
    orderBy: { numero: "asc" },
  });
  if (mesasAbiertas.length > 0) {
    await enviarAlertaTelegram(
      `⚠️ Cierre de caja bloqueado\nJornada: ${fecha}\nOperador: ${operador.nombre} (${operador.rol})\nMesas abiertas con saldo: ${mesasAbiertas.map((mesa) => mesa.apodo || mesa.nombre).join(", ")}`
    );
    return {
      estado: "MESAS_ABIERTAS",
      mesasAbiertas: mesasAbiertas.map((mesa) => mesa.apodo || mesa.nombre),
    };
  }

  // La última venta pendiente identifica de forma estable este lote. Así dos cierres
  // simultáneos no lo duplican, pero una venta posterior habilita un cierre nuevo.
  const ultimaVentaPendiente = await prisma.venta.findFirst({
    where: {
      negocioId,
      estado: "CERRADA",
      createdAt: { gte: desde, lte: hasta },
      closedAt: { lt: hasta },
    },
    orderBy: { id: "desc" },
    select: { id: true },
  });
  if (!ultimaVentaPendiente) return { estado: "SIN_VENTAS" };

  const referencia = `cierre-caja:${fecha}:hasta-venta:${ultimaVentaPendiente.id}`;
  const cierreExistente = await prisma.impresionTrabajo.findUnique({
    where: { negocioId_referencia: { negocioId, referencia } },
    select: { id: true },
  });
  if (cierreExistente) return { estado: "YA_CERRADO" };

  const [reporte, configuracion, control] = await Promise.all([
    obtenerReporteVentas(desde, hasta, {
      limiteProductos: null,
      negocioId,
      etiquetaDesde: fecha,
      etiquetaHasta: fecha,
      soloPendientesCierre: true,
    }),
    prisma.configuracion.findUnique({ where: { negocioId }, select: { nombrePrograma: true } }),
    prisma.controlCaja.findUnique({
      where: { negocioId_fechaJornada: { negocioId, fechaJornada: fecha } },
      include: { movimientos: true },
    }),
  ]);
  // No crear referencias, tickets ni PDFs vacíos: un cierre sin ventas no debe impedir
  // cerrar las ventas que se realicen más tarde durante esa misma noche.
  if (reporte.cantidadVentas === 0) return { estado: "SIN_VENTAS" };
  const dinero = (valor: number) => `$${formatearMoneda(valor)}`;
  const fila = (nombre: string, valor: number) =>
    `${nombre}${dinero(valor).padStart(Math.max(1, 32 - nombre.length))}`;
  const lineas = [
    `[[TITLE]] ${(configuracion?.nombrePrograma || "GESTION").toUpperCase()}`,
    "[[SUBTITLE]] CIERRE DE CAJA",
    "[[HR]]",
    `[[CENTER]] ${formatearFechaHora(new Date())}`,
    `[[CENTER]] ${operador.nombre.toUpperCase()} - ${operador.rol}`,
    "[[HR]]",
    "[[SECTION]] RESUMEN DEL DIA",
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
  const controlPendiente = control && !control.cerradoAt ? control : null;
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

  try {
    const trabajo = await prisma.$transaction(async (tx) => {
      const creado = await tx.impresionTrabajo.create({
        data: { tipo: "TICKET", contenido: lineas.join("\n"), impresora: null, referencia, negocioId },
        select: { id: true },
      });
      await tx.venta.updateMany({
        where: {
          negocioId,
          estado: "CERRADA",
          createdAt: { gte: desde, lte: hasta },
          closedAt: { lt: hasta },
        },
        data: { closedAt: hasta },
      });
      if (controlPendiente) {
        await tx.controlCaja.update({
          where: { id: controlPendiente.id },
          data: { cerradoAt: new Date() },
        });
        const fechaSiguiente = fechaArgentinaYMD(new Date(hasta.getTime() + 1));
        await tx.controlCaja.upsert({
          where: { negocioId_fechaJornada: { negocioId, fechaJornada: fechaSiguiente } },
          update: {},
          create: { negocioId, fechaJornada: fechaSiguiente, saldoInicial: saldoSiguiente },
        });
      }
      return creado;
    });
    await notificarNuevaImpresion();
    let telegramEnviado = false;
    let telegramError: string | undefined;
    try {
      const pdf = generarPdfCierreCaja({
        nombreNegocio: configuracion?.nombrePrograma || "Gestión",
        fechaJornada: fecha,
        operador,
        reporte,
        controlCaja: resumenControl,
      });
      const envioTelegram = await enviarDocumentoTelegram(
        pdf,
        `cierre-caja-${fecha}.pdf`,
        `Cierre de caja · ${fecha}\n${reporte.cantidadVentas} ventas · $${formatearMoneda(reporte.combinado.total)}`
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
      cantidadVentas: reporte.cantidadVentas,
      total: reporte.combinado.total,
      telegramEnviado,
      ...(telegramError ? { telegramError } : {}),
    };
  } catch (error) {
    // Dos solicitudes simultáneas (por ejemplo el cajero y el cron) compiten por la
    // referencia única: una gana y la otra se considera correctamente ya cerrada.
    if (typeof error === "object" && error && "code" in error && error.code === "P2002") {
      return { estado: "YA_CERRADO" };
    }
    throw error;
  }
}
