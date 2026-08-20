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

/** Fecha (YYYY-MM-DD) del día actual en horario argentino, sin depender del timezone del servidor. */
export function fechaArgentinaYMD(fecha: Date = new Date()): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Argentina/Cordoba",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(fecha);
}

/** Límites [00:00:00, 23:59:59.999] del día YMD dado, interpretados en horario argentino (UTC-3). */
export function limitesDiaArgentino(fechaYMD: string): { desde: Date; hasta: Date } {
  return {
    desde: new Date(`${fechaYMD}T00:00:00-03:00`),
    hasta: new Date(`${fechaYMD}T23:59:59.999-03:00`),
  };
}

/**
 * Jornada comercial argentina: comienza a las 06:00 y termina a las 05:59:59.999
 * del día siguiente. Entre medianoche y las 05:59, las ventas siguen perteneciendo
 * a la jornada que comenzó el día anterior.
 */
export function limitesJornadaArgentina(ahora: Date = new Date()): {
  fecha: string;
  desde: Date;
  hasta: Date;
} {
  const fechaActual = fechaArgentinaYMD(ahora);
  const horaActual = Number(
    new Intl.DateTimeFormat("en-US", {
      timeZone: "America/Argentina/Cordoba",
      hour: "2-digit",
      hourCycle: "h23",
    }).format(ahora)
  );
  const inicioJornada =
    horaActual < 6
      ? fechaArgentinaYMD(new Date(new Date(`${fechaActual}T12:00:00-03:00`).getTime() - 24 * 60 * 60 * 1000))
      : fechaActual;
  const desde = new Date(`${inicioJornada}T06:00:00-03:00`);
  return {
    fecha: inicioJornada,
    desde,
    hasta: new Date(desde.getTime() + 24 * 60 * 60 * 1000 - 1),
  };
}
