import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { fechaArgentinaYMD } from "@/lib/formato";
import { conBloqueoCaja, filtroVentasCajaActual } from "@/lib/cajaManual";
import { sesionActual } from "@/lib/sesionServidor";

const redondear = (valor: number) => Math.round(valor * 100) / 100;

async function obtenerEstado(negocioId: number) {
  const filtroVentas = await filtroVentasCajaActual(negocioId);
  const [ultimaCaja, anterior] = await Promise.all([
    prisma.controlCaja.findFirst({
      where: { negocioId },
      include: { movimientos: { orderBy: { createdAt: "desc" } } },
      orderBy: { id: "desc" },
    }),
    prisma.controlCaja.findFirst({
      where: { negocioId, cerradoAt: { not: null }, saldoSiguiente: { not: null } },
      orderBy: { cerradoAt: "desc" },
      select: { saldoSiguiente: true },
    }),
  ]);
  // Las cajas antiguas incompletas no vuelven a activarse al cerrar la última.
  const control = ultimaCaja && !ultimaCaja.cerradoAt ? ultimaCaja : null;
  const [ventasConEfectivo, cobrosCuentaEfectivo] = await Promise.all([
    prisma.venta.findMany({
      where: filtroVentas,
      select: { pagos: { where: { metodo: "EFECTIVO" }, select: { monto: true } } },
    }),
    control
      ? prisma.movimientoCuentaCorriente.aggregate({
          where: {
            tipo: "PAGO",
            metodo: "EFECTIVO",
            createdAt: { gte: control.createdAt },
            cliente: { negocioId },
          },
          _sum: { monto: true },
        })
      : Promise.resolve({ _sum: { monto: null } }),
  ]);
  const ingresos = control?.movimientos
    .filter((movimiento) => movimiento.tipo === "INGRESO")
    .reduce((total, movimiento) => total + movimiento.monto, 0) ?? 0;
  const egresos = control?.movimientos
    .filter((movimiento) => movimiento.tipo === "EGRESO")
    .reduce((total, movimiento) => total + movimiento.monto, 0) ?? 0;
  // Los cobros pendientes siguen visibles hasta el cierre manual, sin filtro de fecha.
  const ventasEfectivo = ventasConEfectivo.reduce(
    (total, venta) => total + venta.pagos.reduce((subtotal, pago) => subtotal + pago.monto, 0),
    0
  );
  const cobrosCuentaCorrienteEfectivo = cobrosCuentaEfectivo._sum.monto ?? 0;
  const saldoInicial = control?.saldoInicial ?? anterior?.saldoSiguiente ?? 0;
  const efectivoEsperado = redondear(
    saldoInicial + ventasEfectivo + cobrosCuentaCorrienteEfectivo + ingresos - egresos
  );
  return {
    fechaJornada: control?.fechaJornada ?? fechaArgentinaYMD(),
    iniciado: Boolean(control),
    control,
    saldoInicial,
    saldoSugerido: anterior?.saldoSiguiente ?? 0,
    ventasEfectivo: redondear(ventasEfectivo),
    cobrosCuentaCorrienteEfectivo: redondear(cobrosCuentaCorrienteEfectivo),
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
  const error = await conBloqueoCaja(sesion.negocioId, async (tx) => {
    const ultimaCaja = await tx.controlCaja.findFirst({
      where: { negocioId: sesion.negocioId },
      orderBy: { id: "desc" },
    });
    const existente = ultimaCaja && !ultimaCaja.cerradoAt ? ultimaCaja : null;

    if (body.accion !== "iniciar" && (!existente || body.controlCajaId !== existente.id)) {
      return NextResponse.json({ error: "La caja cambió. Actualizá la pantalla antes de continuar." }, { status: 409 });
    }
    if (body.accion === "iniciar") {
      const saldoInicial = Number(body.saldoInicial);
      if (body.saldoInicial == null || String(body.saldoInicial).trim() === "" || !Number.isFinite(saldoInicial) || saldoInicial < 0) {
        return NextResponse.json({ error: "El efectivo inicial no es válido" }, { status: 400 });
      }
      if (existente) {
        return NextResponse.json({ error: "Ya hay una caja abierta. Cerrala antes de iniciar otra." }, { status: 409 });
      } else {
        await tx.controlCaja.create({ data: {
          negocioId: sesion.negocioId,
          fechaJornada: fechaArgentinaYMD(),
          saldoInicial: redondear(saldoInicial),
        } });
      }
    } else if (body.accion === "movimiento") {
      const monto = Number(body.monto);
      const concepto = String(body.concepto || "").trim();
      const tipo = body.tipo === "EGRESO" ? "EGRESO" : body.tipo === "INGRESO" ? "INGRESO" : null;
      if (!existente) return NextResponse.json({ error: "Primero iniciá la caja" }, { status: 409 });
      if (!tipo || !Number.isFinite(monto) || monto <= 0 || !concepto) {
        return NextResponse.json({ error: "Completá tipo, monto y concepto" }, { status: 400 });
      }
      await tx.movimientoCaja.create({
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
      if (body.efectivoContado == null || body.saldoSiguiente == null || String(body.efectivoContado).trim() === "" || String(body.saldoSiguiente).trim() === "" || ![efectivoContado, saldoSiguiente].every((valor) => Number.isFinite(valor) && valor >= 0)) {
        return NextResponse.json({ error: "Los importes del arqueo no son válidos" }, { status: 400 });
      }
      await tx.controlCaja.update({
        where: { id: existente.id },
        data: {
          efectivoContado: redondear(efectivoContado),
          saldoSiguiente: redondear(saldoSiguiente),
        },
      });
    } else if (body.accion === "eliminar_movimiento") {
      if (!existente) return NextResponse.json({ error: "La caja no está iniciada" }, { status: 409 });
      const movimientoId = Number(body.movimientoId);
      if (!Number.isInteger(movimientoId)) {
        return NextResponse.json({ error: "Movimiento inválido" }, { status: 400 });
      }
      const eliminado = await tx.movimientoCaja.deleteMany({
        where: { id: movimientoId, controlCajaId: existente.id },
      });
      if (eliminado.count === 0) {
        return NextResponse.json({ error: "El movimiento no existe en esta jornada" }, { status: 404 });
      }
    } else {
      return NextResponse.json({ error: "Acción inválida" }, { status: 400 });
    }

    return null;
  });
  if (error) return error;
  return NextResponse.json(await obtenerEstado(sesion.negocioId));
}
