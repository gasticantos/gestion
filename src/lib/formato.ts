const formatoMoneda = new Intl.NumberFormat("es-AR", {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

const formatoFechaHora = new Intl.DateTimeFormat("es-AR", {
  timeZone: "America/Argentina/Cordoba",
  day: "2-digit",
  month: "2-digit",
  year: "numeric",
  hour: "2-digit",
  minute: "2-digit",
  second: "2-digit",
  hour12: false,
});

export function formatearMoneda(valor: number): string {
  return formatoMoneda.format(valor);
}

export function formatearFechaHora(fecha: Date | string): string {
  return formatoFechaHora.format(typeof fecha === "string" ? new Date(fecha) : fecha);
}
