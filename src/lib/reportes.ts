import { prisma } from "@/lib/prisma";
import type { TransaccionCaja } from "@/lib/cajaManual";
import { fechaArgentinaYMD, fechaReporteYMD } from "@/lib/formato";

const METODOS = ["EFECTIVO", "TARJETA", "TRANSFERENCIA", "FIADO"] as const;
type Metodo = (typeof METODOS)[number];
type TipoTarjeta = "QR" | "DEBITO" | "CREDITO";
type DesgloseTarjeta = Record<TipoTarjeta, number>;
type MetodoCobroCuenta = "EFECTIVO" | "TARJETA" | "TRANSFERENCIA";
export type CobrosCuentaCorriente = {
  cantidad: number;
  total: number;
  porMetodo: Record<MetodoCobroCuenta, number>;
};
type MovimientoCobro = { monto: number; metodo: string | null };

export type ReporteVentas = {
  desde: string;
  hasta: string;
  cantidadVentas: number;
  porCanal: Record<"MOSTRADOR" | "MESA", { cantidad: number; total: number; propina: number; pagos: Record<Metodo, number>; tarjetas: DesgloseTarjeta }>;
  combinado: { total: number; propina: number; pagos: Record<Metodo, number>; tarjetas: DesgloseTarjeta };
  cobrosCuentaCorriente: CobrosCuentaCorriente;
  categorias: { categoria: string; cantidad: number; importe: number }[];
  productos: { nombre: string; cantidad: number; importe: number }[];
  serieDiaria: { fecha: string; total: number }[];
};

function pagosVacio(): Record<Metodo, number> {
  return Object.fromEntries(METODOS.map((m) => [m, 0])) as Record<Metodo, number>;
}

function tarjetasVacio(): DesgloseTarjeta {
  return { QR: 0, DEBITO: 0, CREDITO: 0 };
}

export async function obtenerCobrosCuentaCorriente(
  desde: Date,
  hasta: Date,
  negocioId: number,
  cliente: Pick<TransaccionCaja, "movimientoCuentaCorriente"> = prisma
): Promise<CobrosCuentaCorriente> {
  const movimientos = await cliente.movimientoCuentaCorriente.findMany({
    where: {
      tipo: "PAGO",
      createdAt: { gte: desde, lte: hasta },
      cliente: { negocioId },
    },
    select: { monto: true, metodo: true },
  });
  return resumirCobrosCuentaCorriente(movimientos);
}

export function resumirCobrosCuentaCorriente(movimientos: MovimientoCobro[]): CobrosCuentaCorriente {
  const resultado: CobrosCuentaCorriente = {
    cantidad: movimientos.length,
    total: 0,
    porMetodo: { EFECTIVO: 0, TARJETA: 0, TRANSFERENCIA: 0 },
  };
  for (const movimiento of movimientos) {
    if (movimiento.metodo === "EFECTIVO" || movimiento.metodo === "TARJETA" || movimiento.metodo === "TRANSFERENCIA") {
      resultado.total += movimiento.monto;
      resultado.porMetodo[movimiento.metodo] += movimiento.monto;
    }
  }
  return resultado;
}

export async function obtenerReporteVentas(
  desde: Date,
  hasta: Date,
  opciones?: {
    limiteProductos?: number | null;
    diaReporte?: boolean;
    negocioId?: number;
    etiquetaDesde?: string;
    etiquetaHasta?: string;
    soloPendientesCierre?: boolean;
    ventaIds?: number[];
  },
  cliente: Pick<TransaccionCaja, "venta" | "movimientoCuentaCorriente"> = prisma
): Promise<ReporteVentas> {
  const [ventas, cobrosCuentaCorriente] = await Promise.all([cliente.venta.findMany({
    where: {
      estado: "CERRADA",
      // Una venta pertenece a la jornada en la que se cobró, no a aquella en la
      // que se abrió la mesa. cierreCajaAt indica por separado si ya fue archivada.
      ...(opciones?.ventaIds
        ? { id: { in: opciones.ventaIds } }
        : { closedAt: { gte: desde, lte: hasta } }),
      ...(opciones?.soloPendientesCierre ? { cierreCajaAt: null } : {}),
      ...(opciones?.negocioId ? { negocioId: opciones.negocioId } : {}),
    },
    include: {
      pagos: true,
      pedidos: { include: { items: { include: { producto: { include: { categoria: true } } } } } },
    },
  }), obtenerCobrosCuentaCorriente(desde, hasta, opciones?.negocioId ?? 1, cliente)]);

  const porCanal = {
    MOSTRADOR: { cantidad: 0, total: 0, propina: 0, pagos: pagosVacio(), tarjetas: tarjetasVacio() },
    MESA: { cantidad: 0, total: 0, propina: 0, pagos: pagosVacio(), tarjetas: tarjetasVacio() },
  };
  const combinado = { total: 0, propina: 0, pagos: pagosVacio(), tarjetas: tarjetasVacio() };
  const categoriaMap = new Map<string, { cantidad: number; importe: number }>();
  const productoMap = new Map<string, { cantidad: number; importe: number }>();
  const diaMap = new Map<string, number>();

  for (const venta of ventas) {
    const canal = porCanal[venta.tipo];
    canal.cantidad += 1;
    canal.total += venta.total;
    canal.propina += venta.propina;
    combinado.total += venta.total;
    combinado.propina += venta.propina;

    for (const pago of venta.pagos) {
      canal.pagos[pago.metodo] += pago.monto;
      combinado.pagos[pago.metodo] += pago.monto;
      if (pago.metodo === "TARJETA") {
        const tipo = pago.tipoTarjeta || "QR";
        canal.tarjetas[tipo] += pago.monto;
        combinado.tarjetas[tipo] += pago.monto;
      }
    }

    const fechaKey = (opciones?.diaReporte ? fechaReporteYMD : fechaArgentinaYMD)(venta.closedAt ?? venta.createdAt);
    diaMap.set(fechaKey, (diaMap.get(fechaKey) ?? 0) + venta.total);

    for (const pedido of venta.pedidos) {
      for (const item of pedido.items) {
        const cat = item.producto.categoria?.nombre ?? "Sin categoría";
        const c = categoriaMap.get(cat) ?? { cantidad: 0, importe: 0 };
        c.cantidad += item.cantidad;
        c.importe += item.subtotal;
        categoriaMap.set(cat, c);

        const p = productoMap.get(item.producto.nombre) ?? { cantidad: 0, importe: 0 };
        p.cantidad += item.cantidad;
        p.importe += item.subtotal;
        productoMap.set(item.producto.nombre, p);
      }
    }
  }

  const categorias = [...categoriaMap.entries()]
    .map(([categoria, v]) => ({ categoria, ...v }))
    .sort((a, b) => b.importe - a.importe);

  const productosOrdenados = [...productoMap.entries()]
    .map(([nombre, v]) => ({ nombre, ...v }))
    .sort((a, b) => b.importe - a.importe);
  const productos =
    opciones?.limiteProductos === null
      ? productosOrdenados
      : opciones?.limiteProductos === undefined
      ? productosOrdenados.slice(0, 10)
      : productosOrdenados.slice(0, opciones.limiteProductos);

  const serieDiaria = [...diaMap.entries()]
    .map(([fecha, total]) => ({ fecha, total }))
    .sort((a, b) => a.fecha.localeCompare(b.fecha));

  return {
    desde: opciones?.etiquetaDesde ?? fechaArgentinaYMD(desde),
    hasta: opciones?.etiquetaHasta ?? fechaArgentinaYMD(hasta),
    cantidadVentas: ventas.length,
    porCanal,
    combinado,
    cobrosCuentaCorriente,
    categorias,
    productos,
    serieDiaria,
  };
}
