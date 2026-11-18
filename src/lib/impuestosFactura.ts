export type ImpuestoFactura = { nombre: string; porcentaje: number };

export function normalizarImpuestos(valor: unknown): ImpuestoFactura[] | null {
  if (!Array.isArray(valor) || valor.length > 3) return valor == null ? [] : null;
  const impuestos = valor.map((item) => ({
    nombre: typeof item === "object" && item !== null && "nombre" in item ? String(item.nombre).trim() : "",
    porcentaje: typeof item === "object" && item !== null && "porcentaje" in item ? Number(item.porcentaje) : NaN,
  }));
  if (impuestos.some((item) => !item.nombre || item.nombre.length > 40 || !Number.isFinite(item.porcentaje) || item.porcentaje < 0 || item.porcentaje > 1000)) return null;
  return impuestos;
}

export function calcularCostoConImpuestos(costoBase: number, impuestos: ImpuestoFactura[]) {
  const porcentajeTotal = impuestos.reduce((total, impuesto) => total + impuesto.porcentaje, 0);
  return Math.round(costoBase * (1 + porcentajeTotal / 100) * 100) / 100;
}
