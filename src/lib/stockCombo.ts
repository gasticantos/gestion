import type { prisma } from "@/lib/prisma";

type Tx = Omit<typeof prisma, "$connect" | "$disconnect" | "$on" | "$transaction" | "$extends">;

/**
 * Descuenta (cantidad > 0) o devuelve (cantidad < 0) stock por la venta de un producto.
 * Si el producto es un combo, el movimiento se aplica a cada componente
 * (cantidad × cantidad del componente) y el stock del combo no se toca.
 */
export async function descontarStock(tx: Tx, productoId: number, cantidad: number) {
  if (!cantidad) return;
  const componentes = await tx.comboItem.findMany({
    where: { comboId: productoId },
    select: { productoId: true, cantidad: true },
  });
  if (componentes.length === 0) {
    await tx.producto.update({ where: { id: productoId }, data: { stock: { decrement: cantidad } } });
    return;
  }
  for (const c of componentes) {
    await tx.producto.update({
      where: { id: c.productoId },
      data: { stock: { decrement: cantidad * c.cantidad } },
    });
  }
}

/** Se lanza dentro de una transacción para deshacerla cuando el combo no es válido. */
export class ErrorCombo extends Error {}

export type ComponenteCombo ={ productoId: number; cantidad: number };

/** Valida la lista de componentes que manda la pantalla de productos. */
export function leerComponentes(valor: unknown): ComponenteCombo[] | string {
  if (valor === undefined || valor === null) return [];
  if (!Array.isArray(valor)) return "Los artículos del combo son inválidos";
  const porProducto = new Map<number, number>();
  for (const c of valor as { productoId?: unknown; cantidad?: unknown }[]) {
    const productoId = Number(c?.productoId);
    const cantidad = Number(c?.cantidad);
    if (!Number.isInteger(productoId) || !Number.isFinite(cantidad) || cantidad <= 0) {
      return "Revisá los artículos y cantidades del combo";
    }
    porProducto.set(productoId, (porProducto.get(productoId) || 0) + cantidad);
  }
  return [...porProducto].map(([productoId, cantidad]) => ({ productoId, cantidad }));
}

/** Reemplaza los componentes de un combo. Devuelve un mensaje si algún componente no sirve. */
export async function guardarComponentes(tx: Tx, comboId: number, componentes: ComponenteCombo[]) {
  if (componentes.some((c) => c.productoId === comboId)) return "Un combo no puede contenerse a sí mismo";
  if (componentes.length > 0) {
    const ids = componentes.map((c) => c.productoId);
    const validos = await tx.producto.findMany({
      where: { id: { in: ids }, componentesCombo: { none: {} } },
      select: { id: true },
    });
    if (validos.length !== ids.length) return "Los artículos del combo tienen que ser productos comunes (no otros combos)";
    const usadoEnOtroCombo = await tx.comboItem.findFirst({ where: { productoId: comboId }, select: { id: true } });
    if (usadoEnOtroCombo) return "Este producto ya forma parte de otro combo, no puede ser un combo";
  }
  await tx.comboItem.deleteMany({ where: { comboId } });
  if (componentes.length > 0) {
    await tx.comboItem.createMany({ data: componentes.map((c) => ({ comboId, ...c })) });
  }
  return null;
}
