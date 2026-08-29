import { prisma } from "@/lib/prisma";
import type { ReporteVentas } from "@/lib/reportes";

const METODOS = ["EFECTIVO", "TARJETA", "TRANSFERENCIA", "FIADO"] as const;

function importeDeLinea(contenido: string, etiqueta: string): number {
  const linea = contenido.split("\n").find((item) => item.includes(etiqueta) && item.includes("$"));
  const valor = linea?.match(/\$([\d.]+,\d{2})/)?.[1];
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
  return {
    id: trabajo.id,
    fecha,
    cantidadVentas: cantidad,
    total: importeDeLinea(trabajo.contenido, "TOTAL VENDIDO"),
    mostrador: importeDeLinea(trabajo.contenido, "MOSTRADOR"),
    mesas: importeDeLinea(trabajo.contenido, "MESAS"),
    pagos,
    operador,
    estadoImpresion: trabajo.estado,
    intentos: trabajo.intentos,
    creadoEn: trabajo.createdAt,
    impresoEn: trabajo.printedAt,
    error: trabajo.error,
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
      MOSTRADOR: { cantidad: 0, total: cierre.mostrador, pagos: pagosVacios() },
      MESA: { cantidad: 0, total: cierre.mesas, pagos: pagosVacios() },
    },
    combinado: { total: cierre.total, pagos: cierre.pagos },
    categorias: [],
    productos: [],
    serieDiaria: cierre.fecha ? [{ fecha: cierre.fecha, total: cierre.total }] : [],
  };
}
