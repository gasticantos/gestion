import { prisma } from "@/lib/prisma";

const METODOS = ["EFECTIVO", "TARJETA", "TRANSFERENCIA", "FIADO"] as const;
type Metodo = (typeof METODOS)[number];

export type ReporteVentas = {
  desde: string;
  hasta: string;
  cantidadVentas: number;
  porCanal: Record<"MOSTRADOR" | "MESA", { total: number; pagos: Record<Metodo, number> }>;
  combinado: { total: number; pagos: Record<Metodo, number> };
  categorias: { categoria: string; cantidad: number; importe: number }[];
  productos: { nombre: string; cantidad: number; importe: number }[];
  serieDiaria: { fecha: string; total: number }[];
};

function pagosVacio(): Record<Metodo, number> {
  return Object.fromEntries(METODOS.map((m) => [m, 0])) as Record<Metodo, number>;
}

export async function obtenerReporteVentas(desde: Date, hasta: Date): Promise<ReporteVentas> {
  const ventas = await prisma.venta.findMany({
    where: {
      estado: "CERRADA",
      closedAt: { gte: desde, lte: hasta },
    },
    include: {
      pagos: true,
      pedidos: { include: { items: { include: { producto: { include: { categoria: true } } } } } },
    },
  });

  const porCanal = {
    MOSTRADOR: { total: 0, pagos: pagosVacio() },
    MESA: { total: 0, pagos: pagosVacio() },
  };
  const combinado = { total: 0, pagos: pagosVacio() };
  const categoriaMap = new Map<string, { cantidad: number; importe: number }>();
  const productoMap = new Map<string, { cantidad: number; importe: number }>();
  const diaMap = new Map<string, number>();

  for (const venta of ventas) {
    const canal = porCanal[venta.tipo];
    canal.total += venta.total;
    combinado.total += venta.total;

    for (const pago of venta.pagos) {
      canal.pagos[pago.metodo] += pago.monto;
      combinado.pagos[pago.metodo] += pago.monto;
    }

    const fechaKey = (venta.closedAt ?? venta.createdAt).toISOString().slice(0, 10);
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

  const productos = [...productoMap.entries()]
    .map(([nombre, v]) => ({ nombre, ...v }))
    .sort((a, b) => b.importe - a.importe)
    .slice(0, 10);

  const serieDiaria = [...diaMap.entries()]
    .map(([fecha, total]) => ({ fecha, total }))
    .sort((a, b) => a.fecha.localeCompare(b.fecha));

  return {
    desde: desde.toISOString().slice(0, 10),
    hasta: hasta.toISOString().slice(0, 10),
    cantidadVentas: ventas.length,
    porCanal,
    combinado,
    categorias,
    productos,
    serieDiaria,
  };
}
