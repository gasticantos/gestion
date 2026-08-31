import { prisma } from "@/lib/prisma";
import type { ReporteVentas } from "@/lib/reportes";

const METODOS = ["EFECTIVO", "TARJETA", "TRANSFERENCIA", "FIADO"] as const;

function importeDeLinea(contenido: string, etiqueta: string): number {
  const linea = contenido.split("\n").find((item) => item.includes(etiqueta) && item.includes("$"));
  const valor = linea?.match(/\$(-?[\d.]+,\d{2})/)?.[1];
  return valor ? Number(valor.replaceAll(".", "").replace(",", ".")) : 0;
}

export function interpretarCierre(trabajo: {
  id: number;
  referencia: string | null;
  contenido: string;
  estado: string;
  intentos: number;
  createdAt: Date;
  printedAt: Date | null;
  error: string | null;
}) {
  const fecha = trabajo.referencia?.match(/^cierre-caja:(\d{4}-\d{2}-\d{2})/)?.[1] || "";
  const cantidad = Number(trabajo.contenido.match(/VENTAS REALIZADAS:\s*(\d+)/)?.[1] || 0);
  const operadorLinea = trabajo.contenido
    .split("\n")
    .find((linea) => /^\[\[CENTER\]\].+ - (DUENIO|CAJERO|CIERRE AUTOMÁTICO)$/.test(linea));
  const operadorTexto = operadorLinea?.replace(/^\[\[CENTER\]\]\s*/, "") || "Sistema - CIERRE AUTOMÁTICO";
  const separador = operadorTexto.lastIndexOf(" - ");
  const operador = {
    nombre: separador >= 0 ? operadorTexto.slice(0, separador) : operadorTexto,
    rol: separador >= 0 ? operadorTexto.slice(separador + 3) : "OPERADOR",
  };
  const pagos = {
    EFECTIVO: importeDeLinea(trabajo.contenido, "EFECTIVO"),
    TARJETA: importeDeLinea(trabajo.contenido, "TARJETA"),
    TRANSFERENCIA: importeDeLinea(trabajo.contenido, "TRANSFERENCIA"),
    FIADO: importeDeLinea(trabajo.contenido, "CUENTA CORRIENTE"),
  };
  const propina = importeDeLinea(trabajo.contenido, "PROPINA");
  const tarjetas = {
    QR: importeDeLinea(trabajo.contenido, "TARJETA QR"),
    DEBITO: importeDeLinea(trabajo.contenido, "TARJETA DEBITO"),
    CREDITO: importeDeLinea(trabajo.contenido, "TARJETA CREDITO"),
  };
  const tieneControl = trabajo.contenido.includes("CONTROL DE EFECTIVO");
  const efectivoContado = trabajo.contenido.includes("EFECTIVO CONTADO")
    ? importeDeLinea(trabajo.contenido, "EFECTIVO CONTADO")
    : null;
  const controlCaja = tieneControl
    ? {
        saldoInicial: importeDeLinea(trabajo.contenido, "EFECTIVO INICIAL"),
        ventasEfectivo: importeDeLinea(trabajo.contenido, "VENTAS EFECTIVO"),
        ingresos: importeDeLinea(trabajo.contenido, "OTROS INGRESOS"),
        egresos: Math.abs(importeDeLinea(trabajo.contenido, "EGRESOS")),
        efectivoEsperado: importeDeLinea(trabajo.contenido, "EFECTIVO ESPERADO"),
        efectivoContado,
        diferencia: efectivoContado == null ? null : importeDeLinea(trabajo.contenido, "DIFERENCIA"),
        saldoSiguiente: importeDeLinea(trabajo.contenido, "INICIO PROXIMA JORNADA"),
      }
    : null;
  return {
    id: trabajo.id,
    fecha,
    cantidadVentas: cantidad,
    total: importeDeLinea(trabajo.contenido, "TOTAL VENDIDO"),
    mostrador: importeDeLinea(trabajo.contenido, "MOSTRADOR"),
    mesas: importeDeLinea(trabajo.contenido, "MESAS"),
    pagos,
    propina,
    tarjetas,
    operador,
    estadoImpresion: trabajo.estado,
    intentos: trabajo.intentos,
    creadoEn: trabajo.createdAt,
    impresoEn: trabajo.printedAt,
    error: trabajo.error,
    controlCaja,
  };
}

export async function obtenerTrabajoCierre(id: number, negocioId: number) {
  const trabajo = await prisma.impresionTrabajo.findFirst({
    where: { id, negocioId, referencia: { startsWith: "cierre-caja:" } },
    select: {
      id: true,
      referencia: true,
      contenido: true,
      estado: true,
      intentos: true,
      createdAt: true,
      printedAt: true,
      error: true,
    },
  });
  return trabajo ? interpretarCierre(trabajo) : null;
}

export function reporteDesdeCierre(cierre: NonNullable<Awaited<ReturnType<typeof obtenerTrabajoCierre>>>): ReporteVentas {
  const pagosVacios = () => Object.fromEntries(METODOS.map((metodo) => [metodo, 0])) as Record<(typeof METODOS)[number], number>;
  return {
    desde: cierre.fecha,
    hasta: cierre.fecha,
    cantidadVentas: cierre.cantidadVentas,
    porCanal: {
      MOSTRADOR: { cantidad: 0, total: cierre.mostrador, propina: 0, pagos: pagosVacios(), tarjetas: { QR: 0, DEBITO: 0, CREDITO: 0 } },
      MESA: { cantidad: 0, total: cierre.mesas, propina: 0, pagos: pagosVacios(), tarjetas: { QR: 0, DEBITO: 0, CREDITO: 0 } },
    },
    combinado: { total: cierre.total, propina: cierre.propina, pagos: cierre.pagos, tarjetas: cierre.tarjetas },
    categorias: [],
    productos: [],
    serieDiaria: cierre.fecha ? [{ fecha: cierre.fecha, total: cierre.total }] : [],
  };
}
