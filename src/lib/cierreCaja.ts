import { prisma } from "@/lib/prisma";
import { notificarNuevaImpresion } from "@/lib/notificarImpresion";
import { formatearFechaHora, formatearMoneda } from "@/lib/formato";
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
      OR: [{ estado: "OCUPADA" }, { ventas: { some: { estado: "ABIERTA" } } }],
    },
    select: { nombre: true, apodo: true },
    orderBy: { numero: "asc" },
  });
  if (mesasAbiertas.length > 0) {
    await enviarAlertaTelegram(
      `⚠️ Cierre de caja bloqueado\nJornada: ${fecha}\nOperador: ${operador.nombre} (${operador.rol})\nMesas abiertas: ${mesasAbiertas.map((mesa) => mesa.apodo || mesa.nombre).join(", ")}`
    );
    return { estado: "MESAS_ABIERTAS", mesasAbiertas: mesasAbiertas.map((mesa) => mesa.apodo || mesa.nombre) };
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

  const [reporte, configuracion] = await Promise.all([
    obtenerReporteVentas(desde, hasta, {
      limiteProductos: null,
      negocioId,
      etiquetaDesde: fecha,
      etiquetaHasta: fecha,
      soloPendientesCierre: true,
    }),
    prisma.configuracion.findUnique({ where: { negocioId }, select: { nombrePrograma: true } }),
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
      await tx.mesa.updateMany({ where: { negocioId }, data: { estado: "LIBRE" } });
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
