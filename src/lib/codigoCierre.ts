/** Identificador estable y legible para cierres nuevos e históricos. */
export function codigoCierre(fechaJornada: string, controlCajaId: number): string {
  const fecha = fechaJornada.replace(/\D/g, "").slice(0, 8).padEnd(8, "0");
  const correlativo = Math.max(0, Math.trunc(controlCajaId))
    .toString(36)
    .toUpperCase()
    .padStart(5, "0");
  return `CJ-${fecha}-${correlativo}`;
}
