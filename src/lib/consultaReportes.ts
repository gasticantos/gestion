import { prisma } from "@/lib/prisma";
import { filtroVentasCajaActual } from "@/lib/cajaManual";
import { fechaArgentinaYMD, limitesRangoReporte } from "@/lib/formato";
import { obtenerReporteVentas } from "@/lib/reportes";

/** Compartido por pantalla, PDF y ticket para que exporten el mismo período. */
export async function consultarReporte(params: URLSearchParams, negocioId: number) {
  const modo = params.get("modo");
  const desdeStr = params.get("desde");
  const hastaStr = params.get("hasta");
  if (modo && modo !== "caja") return null;

  if (modo === "caja" || (!desdeStr && !hastaStr)) {
    return prisma.$transaction(async (tx) => {
      const ultimaCaja = await tx.controlCaja.findFirst({
        where: { negocioId }, orderBy: { id: "desc" },
        select: { id: true, fechaJornada: true, createdAt: true, cerradoAt: true },
      });
      const caja = ultimaCaja && !ultimaCaja.cerradoAt ? ultimaCaja : null;
      const ahora = new Date();
      const ventas = caja ? await tx.venta.findMany({
        where: await filtroVentasCajaActual(negocioId, tx),
        select: { id: true },
      }) : [];
      const reporte = await obtenerReporteVentas(caja?.createdAt ?? ahora, caja?.cerradoAt ?? ahora, {
        negocioId, ventaIds: ventas.map(v => v.id), limiteProductos: null,
        etiquetaDesde: caja?.fechaJornada ?? fechaArgentinaYMD(ahora),
        etiquetaHasta: fechaArgentinaYMD(caja?.cerradoAt ?? ahora),
      }, tx);
      return { ...reporte, caja, modoCaja: true };
    }, { isolationLevel: "RepeatableRead", timeout: 15000 });
  }

  if (!desdeStr || !hastaStr || !/^\d{4}-\d{2}-\d{2}$/.test(desdeStr) || !/^\d{4}-\d{2}-\d{2}$/.test(hastaStr)) return null;
  const { desde, hasta } = limitesRangoReporte(desdeStr, hastaStr);
  if (!Number.isFinite(desde.getTime()) || !Number.isFinite(hasta.getTime()) || desde > hasta) return null;
  const reporte = await obtenerReporteVentas(desde, hasta, {
    diaReporte: true, negocioId, etiquetaDesde: desdeStr, etiquetaHasta: hastaStr, limiteProductos: null,
  });
  return { ...reporte, caja: null, modoCaja: false };
}
