export type Tarifa = "PARTICULAR" | "MESA";

export function calcularPrecio(precioBase: number, tarifa: Tarifa, recargoMesaPct: number) {
  return tarifa === "MESA" ? precioBase * (1 + recargoMesaPct / 100) : precioBase;
}

// El precio de mesa ya no se calcula al vuelo: cada producto tiene su propio precioVentaMesa
// guardado (editable a mano, o auto-recalculado desde Configuración cuando cambia el recargo).
export function precioSegunTarifa(producto: { precioVenta: number; precioVentaMesa: number }, tarifa: Tarifa) {
  return tarifa === "MESA" ? producto.precioVentaMesa : producto.precioVenta;
}

export function aplicarDescuento(subtotal: number, descuentoPct: number) {
  const pct = Math.min(100, Math.max(0, descuentoPct || 0));
  const monto = Math.round(subtotal * (pct / 100) * 100) / 100;
  const total = Math.round((subtotal - monto) * 100) / 100;
  return { pct, monto, total };
}
