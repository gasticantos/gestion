const formatoMoneda = new Intl.NumberFormat("es-AR", {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

export function formatearMoneda(valor: number): string {
  return formatoMoneda.format(valor);
}
