import { NextRequest, NextResponse } from "next/server";
import { obtenerReporteVentas } from "@/lib/reportes";
import { formatearFechaHora, formatearMoneda } from "@/lib/formato";
import { prisma } from "@/lib/prisma";
import { sesionActual } from "@/lib/sesionServidor";
import { obtenerUsuarioIdDesdeRequest, registrarAuditoria } from "@/lib/auditoria";

const METODOS = {
  EFECTIVO: "EFECTIVO",
  TARJETA: "TARJETA",
  TRANSFERENCIA: "TRANSFERENCIA",
  FIADO: "CUENTA CORRIENTE",
} as const;

function fechaArgentinaYMD() {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Argentina/Cordoba",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
}

export async function POST(req: NextRequest) {
  const sesion = await sesionActual();
  if (!sesion || sesion.rol === "MOZO") {
    return NextResponse.json({ error: "No tenés permiso para cerrar la caja" }, { status: 403 });
  }

  const mesasAbiertas = await prisma.mesa.findMany({
    where: {
      OR: [
        { estado: "OCUPADA" },
        { ventas: { some: { estado: "ABIERTA" } } },
      ],
    },
    select: { nombre: true, apodo: true },
    orderBy: { numero: "asc" },
  });
  if (mesasAbiertas.length > 0) {
    const nombres = mesasAbiertas.map((mesa) => mesa.apodo || mesa.nombre);
    return NextResponse.json(
      {
        error: `No se puede cerrar la caja. Hay ${mesasAbiertas.length} mesa(s) abierta(s): ${nombres.join(", ")}`,
        mesasAbiertas: nombres,
      },
      { status: 409 }
    );
  }

  const fecha = fechaArgentinaYMD();
  const desde = new Date(`${fecha}T00:00:00-03:00`);
  const hasta = new Date(`${fecha}T23:59:59.999-03:00`);
  const [reporte, configuracion] = await Promise.all([
    obtenerReporteVentas(desde, hasta, { limiteProductos: 0 }),
    prisma.configuracion.findFirst({ select: { nombrePrograma: true } }),
  ]);

  const dinero = (valor: number) => `$${formatearMoneda(valor)}`;
  const fila = (nombre: string, valor: number) =>
    `${nombre}${dinero(valor).padStart(Math.max(1, 32 - nombre.length))}`;
  const lineas: string[] = [
    `[[TITLE]] ${(configuracion?.nombrePrograma || "GESTION").toUpperCase()}`,
    "[[SUBTITLE]] CIERRE DE CAJA",
    "[[HR]]",
    `[[CENTER]] ${formatearFechaHora(new Date())}`,
    `[[CENTER]] ${sesion.nombre.toUpperCase()} - ${sesion.rol}`,
    "[[HR]]",
    "[[SECTION]] RESUMEN DEL DIA",
    `[[ROW]] VENTAS REALIZADAS: ${reporte.cantidadVentas}`,
    `[[ROW]] ${fila("MOSTRADOR", reporte.porCanal.MOSTRADOR.total)}`,
    `[[ROW]] ${fila("MESAS", reporte.porCanal.MESA.total)}`,
    `[[TOTAL]] ${fila("TOTAL VENDIDO", reporte.combinado.total)}`,
    "[[HR]]",
    "[[SECTION]] MEDIOS DE PAGO",
  ];

  for (const metodo of Object.keys(METODOS) as (keyof typeof METODOS)[]) {
    lineas.push(`[[ROW]] ${fila(METODOS[metodo], reporte.combinado.pagos[metodo])}`);
  }

  lineas.push("[[HR]]", "[[SECTION]] CATEGORIAS");
  if (reporte.categorias.length === 0) {
    lineas.push("[[CENTER]] SIN MOVIMIENTOS");
  } else {
    for (const categoria of reporte.categorias) {
      lineas.push(
        `[[ROW]] ${categoria.categoria}: ${categoria.cantidad} u. - ${dinero(categoria.importe)}`
      );
    }
  }
  lineas.push("[[HR]]", "[[FOOTER]] Fin del cierre de caja", "");

  const trabajo = await prisma.impresionTrabajo.create({
    data: {
      tipo: "TICKET",
      contenido: lineas.join("\n"),
      impresora: null,
    },
    select: { id: true },
  });

  const usuarioId = await obtenerUsuarioIdDesdeRequest(req);
  await registrarAuditoria(
    usuarioId,
    "cerrar_caja",
    `Cierre ${fecha} - ${reporte.cantidadVentas} ventas - Total ${dinero(reporte.combinado.total)}`
  );

  return NextResponse.json({
    success: true,
    trabajoId: trabajo.id,
    fecha,
    cantidadVentas: reporte.cantidadVentas,
    total: reporte.combinado.total,
  });
}
