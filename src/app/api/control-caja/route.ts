import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { limitesJornadaArgentina } from "@/lib/formato";
import { sesionActual } from "@/lib/sesionServidor";

const redondear = (valor: number) => Math.round(valor * 100) / 100;

async function obtenerEstado(negocioId: number) {
  const jornada = limitesJornadaArgentina();
  const [control, ventasConEfectivo, anterior] = await Promise.all([
    prisma.controlCaja.findUnique({
      where: { negocioId_fechaJornada: { negocioId, fechaJornada: jornada.fecha } },
      include: { movimientos: { orderBy: { createdAt: "desc" } } },
    }),
    prisma.venta.findMany({
      where: {
        negocioId,
        estado: "CERRADA",
        createdAt: { gte: jornada.desde, lte: jornada.hasta },
      },
      select: { pagos: { where: { metodo: "EFECTIVO" }, select: { monto: true } } },
    }),
    prisma.controlCaja.findFirst({
      where: { negocioId, fechaJornada: { lt: jornada.fecha }, saldoSiguiente: { not: null } },
      orderBy: { fechaJornada: "desc" },
      select: { saldoSiguiente: true },
    }),
  ]);
  const ingresos = control?.movimientos
    .filter((movimiento) => movimiento.tipo === "INGRESO")
    .reduce((total, movimiento) => total + movimiento.monto, 0) ?? 0;
  const egresos = control?.movimientos
    .filter((movimiento) => movimiento.tipo === "EGRESO")
    .reduce((total, movimiento) => total + movimiento.monto, 0) ?? 0;
  // Consultar desde Venta conserva el filtro de jornada y negocio. Una consulta directa
  // sobre Pago podía perder el rango al aplicar el aislamiento multinegocio y sumar el histórico.
  const ventasEfectivo = ventasConEfectivo.reduce(
    (total, venta) => total + venta.pagos.reduce((subtotal, pago) => subtotal + pago.monto, 0),
    0
  );
  const saldoInicial = control?.saldoInicial ?? anterior?.saldoSiguiente ?? 0;
  const efectivoEsperado = redondear(saldoInicial + ventasEfectivo + ingresos - egresos);
  return {
    fechaJornada: jornada.fecha,
    iniciado: Boolean(control),
    control,
    saldoInicial,
    saldoSugerido: anterior?.saldoSiguiente ?? 0,
    ventasEfectivo: redondear(ventasEfectivo),
    ingresos: redondear(ingresos),
    egresos: redondear(egresos),
    efectivoEsperado,
    diferencia:
      control?.efectivoContado == null ? null : redondear(control.efectivoContado - efectivoEsperado),
  };
}

export async function GET() {
  const sesion = await sesionActual();
  if (!sesion || sesion.rol === "MOZO") {
    return NextResponse.json({ error: "No tenés permiso para controlar la caja" }, { status: 403 });
  }
  return NextResponse.json(await obtenerEstado(sesion.negocioId));
}

export async function POST(req: NextRequest) {
  const sesion = await sesionActual();
  if (!sesion || sesion.rol === "MOZO") {
    return NextResponse.json({ error: "No tenés permiso para controlar la caja" }, { status: 403 });
  }
  const body = await req.json().catch(() => ({}));
  const jornada = limitesJornadaArgentina();
  const existente = await prisma.controlCaja.findUnique({
    where: { negocioId_fechaJornada: { negocioId: sesion.negocioId, fechaJornada: jornada.fecha } },
  });
  if (existente?.cerradoAt) {
    return NextResponse.json({ error: "El control de esta jornada ya está cerrado" }, { status: 409 });
  }

  if (body.accion === "iniciar") {
    const saldoInicial = Number(body.saldoInicial);
    if (!Number.isFinite(saldoInicial) || saldoInicial < 0) {
      return NextResponse.json({ error: "El efectivo inicial no es válido" }, { status: 400 });
    }
    await prisma.controlCaja.upsert({
      where: { negocioId_fechaJornada: { negocioId: sesion.negocioId, fechaJornada: jornada.fecha } },
      update: { saldoInicial: redondear(saldoInicial) },
      create: {
        negocioId: sesion.negocioId,
        fechaJornada: jornada.fecha,
        saldoInicial: redondear(saldoInicial),
      },
    });
  } else if (body.accion === "movimiento") {
    const monto = Number(body.monto);
    const concepto = String(body.concepto || "").trim();
    const tipo = body.tipo === "EGRESO" ? "EGRESO" : body.tipo === "INGRESO" ? "INGRESO" : null;
    if (!existente) return NextResponse.json({ error: "Primero iniciá la caja" }, { status: 409 });
    if (!tipo || !Number.isFinite(monto) || monto <= 0 || !concepto) {
      return NextResponse.json({ error: "Completá tipo, monto y concepto" }, { status: 400 });
    }
    await prisma.movimientoCaja.create({
      data: {
        controlCajaId: existente.id,
        tipo,
        monto: redondear(monto),
        concepto: concepto.slice(0, 160),
        operador: `${sesion.nombre} (${sesion.rol})`,
      },
    });
  } else if (body.accion === "arqueo") {
    if (!existente) return NextResponse.json({ error: "Primero iniciá la caja" }, { status: 409 });
    const efectivoContado = Number(body.efectivoContado);
    const saldoSiguiente = Number(body.saldoSiguiente);
    if (![efectivoContado, saldoSiguiente].every((valor) => Number.isFinite(valor) && valor >= 0)) {
      return NextResponse.json({ error: "Los importes del arqueo no son válidos" }, { status: 400 });
    }
    await prisma.controlCaja.update({
      where: { id: existente.id },
      data: {
        efectivoContado: redondear(efectivoContado),
        saldoSiguiente: redondear(saldoSiguiente),
      },
    });
  } else {
    return NextResponse.json({ error: "Acción inválida" }, { status: 400 });
  }

  return NextResponse.json(await obtenerEstado(sesion.negocioId));
}
