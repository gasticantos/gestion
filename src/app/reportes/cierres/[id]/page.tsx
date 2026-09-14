import Link from "next/link";
import { notFound } from "next/navigation";
import Card from "@/components/ui/Card";
import { codigoCierre } from "@/lib/codigoCierre";
import { formatearFechaHora, formatearMoneda } from "@/lib/formato";
import { prisma } from "@/lib/prisma";
import { sesionActual } from "@/lib/sesionServidor";

const NOMBRE_PAGO = {
  EFECTIVO: "Efectivo",
  TARJETA: "Tarjeta",
  TRANSFERENCIA: "Transferencia",
  FIADO: "Cuenta corriente",
} as const;

const NOMBRE_TARJETA = { QR: "QR", DEBITO: "Débito", CREDITO: "Crédito" } as const;

export default async function DetalleCierrePage({ params }: { params: Promise<{ id: string }> }) {
  const sesion = await sesionActual();
  if (!sesion || sesion.rol === "MOZO") notFound();
  const { id: idTexto } = await params;
  const id = Number(idTexto);
  if (!Number.isInteger(id)) notFound();

  const trabajo = await prisma.impresionTrabajo.findFirst({
    where: { id, negocioId: sesion.negocioId, referencia: { startsWith: "cierre-caja:" } },
    select: { referencia: true, createdAt: true },
  });
  if (!trabajo) notFound();

  const fecha = trabajo.referencia?.match(/^cierre-caja:(\d{4}-\d{2}-\d{2})/)?.[1] || "";
  const controlCajaId = Number(trabajo.referencia?.match(/:control:(\d+)$/)?.[1]);
  const hastaVentaId = Number(trabajo.referencia?.match(/:hasta-venta:(\d+)$/)?.[1]);
  const control = Number.isInteger(controlCajaId)
    ? await prisma.controlCaja.findFirst({
        where: { id: controlCajaId, negocioId: sesion.negocioId },
        include: { movimientos: { orderBy: { createdAt: "asc" } } },
      })
    : null;
  const [ventaAncla, cierreAnterior] = await Promise.all([
    !control && Number.isInteger(hastaVentaId)
      ? prisma.venta.findFirst({
          where: { id: hastaVentaId, negocioId: sesion.negocioId },
          select: { cierreCajaAt: true },
        })
      : null,
    !control
      ? prisma.impresionTrabajo.findFirst({
          where: {
            negocioId: sesion.negocioId,
            referencia: { startsWith: "cierre-caja:" },
            createdAt: { lt: trabajo.createdAt },
          },
          orderBy: { createdAt: "desc" },
          select: { createdAt: true },
        })
      : null,
  ]);
  const inicio = control?.createdAt ?? cierreAnterior?.createdAt ?? new Date(`${fecha}T10:00:00.000Z`);
  const fin = control?.cerradoAt ?? ventaAncla?.cierreCajaAt ?? trabajo.createdAt;
  const codigo = codigoCierre(fecha, Number.isInteger(controlCajaId) ? controlCajaId : id);

  const [ventas, cobrosCuenta] = await Promise.all([
    prisma.venta.findMany({
      where: {
        negocioId: sesion.negocioId,
        estado: "CERRADA",
        OR: [
          { cierreCajaAt: fin },
          { cierreCajaAt: trabajo.createdAt },
        ],
      },
      include: {
        mesa: { select: { nombre: true, apodo: true } },
        cliente: { select: { nombre: true } },
        pagos: { orderBy: { id: "asc" } },
        pedidos: {
          orderBy: { createdAt: "asc" },
          include: {
            items: {
              orderBy: { id: "asc" },
              include: { producto: { select: { nombre: true } } },
            },
          },
        },
      },
      orderBy: [{ closedAt: "asc" }, { id: "asc" }],
    }),
    prisma.movimientoCuentaCorriente.findMany({
      where: {
        tipo: "PAGO",
        createdAt: { gte: inicio, lte: fin },
        cliente: { negocioId: sesion.negocioId },
      },
      include: { cliente: { select: { nombre: true } } },
      orderBy: { createdAt: "asc" },
    }),
  ]);

  const totalVentas = ventas.reduce((suma, venta) => suma + venta.total, 0);
  const totalPropinas = ventas.reduce((suma, venta) => suma + venta.propina, 0);
  const totalCobrosCuenta = cobrosCuenta.reduce((suma, cobro) => suma + cobro.monto, 0);

  return (
    <div className="mx-auto flex max-w-7xl flex-col gap-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="font-mono text-sm font-semibold text-blue-600 dark:text-blue-400">{codigo}</p>
          <h1 className="text-2xl font-semibold tracking-tight">Detalle completo del cierre</h1>
          <p className="mt-1 text-sm text-neutral-500">
            Jornada {fecha} · {formatearFechaHora(inicio)} a {formatearFechaHora(fin)}
          </p>
        </div>
        <Link
          href="/reportes"
          className="rounded-lg border border-neutral-300 px-3 py-2 text-sm font-medium hover:bg-neutral-100 dark:border-neutral-700 dark:hover:bg-neutral-800"
        >
          Volver a reportes
        </Link>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {[
          ["Ventas", String(ventas.length)],
          ["Total vendido", `$${formatearMoneda(totalVentas)}`],
          ["Propinas", `$${formatearMoneda(totalPropinas)}`],
          ["Cobros de cuenta corriente", `$${formatearMoneda(totalCobrosCuenta)}`],
        ].map(([titulo, valor]) => (
          <Card key={titulo} className="p-4">
            <div className="text-xs text-neutral-500">{titulo}</div>
            <div className="mt-1 text-xl font-semibold">{valor}</div>
          </Card>
        ))}
      </div>

      <section className="flex flex-col gap-3">
        <h2 className="text-lg font-semibold">Ventas y mesas cobradas, una por una</h2>
        {ventas.length === 0 ? (
          <Card className="p-4 text-sm text-neutral-500">Este cierre no tiene ventas asociadas.</Card>
        ) : ventas.map((venta, indice) => {
          const items = venta.pedidos.flatMap((pedido) => pedido.items);
          const subtotal = items.reduce((suma, item) => suma + item.subtotal, 0);
          const origen = venta.mesa ? venta.mesa.apodo || venta.mesa.nombre : "Mostrador";
          return (
            <Card key={venta.id} className="overflow-hidden">
              <div className="flex flex-wrap items-center justify-between gap-2 border-b border-neutral-200 bg-neutral-50 px-4 py-3 dark:border-neutral-800 dark:bg-neutral-950/50">
                <div>
                  <span className="font-semibold">#{indice + 1} · Venta #{venta.id} · {origen}</span>
                  {venta.cliente && <span className="ml-2 text-sm text-neutral-500">· Cliente: {venta.cliente.nombre}</span>}
                </div>
                <span className="text-sm text-neutral-500">{formatearFechaHora(venta.closedAt ?? venta.createdAt)}</span>
              </div>
              <div className="grid gap-5 p-4 lg:grid-cols-[1fr_300px]">
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="text-left text-xs uppercase text-neutral-500">
                        <th className="pb-2 pr-3">Producto</th>
                        <th className="pb-2 pr-3 text-right">Cantidad</th>
                        <th className="pb-2 pr-3 text-right">Precio</th>
                        <th className="pb-2 text-right">Subtotal</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-neutral-200 dark:divide-neutral-800">
                      {items.map((item) => (
                        <tr key={item.id}>
                          <td className="py-2 pr-3">
                            <div className="font-medium">{item.producto.nombre}</div>
                            {item.notas && <div className="text-xs text-amber-700 dark:text-amber-400">Nota: {item.notas}</div>}
                          </td>
                          <td className="py-2 pr-3 text-right">{item.cantidad}</td>
                          <td className="py-2 pr-3 text-right">${formatearMoneda(item.precioUnitario)}</td>
                          <td className="py-2 text-right font-medium">${formatearMoneda(item.subtotal)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between"><span className="text-neutral-500">Subtotal</span><span>${formatearMoneda(subtotal)}</span></div>
                  {venta.descuentoPct > 0 && (
                    <div className="flex justify-between text-amber-700 dark:text-amber-400">
                      <span>Descuento {venta.descuentoPct}%{venta.descuentoResponsable ? ` · ${venta.descuentoResponsable}` : ""}</span>
                      <span>-${formatearMoneda(subtotal - venta.total)}</span>
                    </div>
                  )}
                  <div className="flex justify-between border-t pt-2 font-semibold dark:border-neutral-800"><span>Total venta</span><span>${formatearMoneda(venta.total)}</span></div>
                  {venta.propina > 0 && <div className="flex justify-between"><span>Propina</span><span>${formatearMoneda(venta.propina)}</span></div>}
                  <div className="pt-2 text-xs font-semibold uppercase text-neutral-500">Cobros</div>
                  {venta.pagos.map((pago) => (
                    <div key={pago.id} className="flex justify-between gap-3">
                      <span>{NOMBRE_PAGO[pago.metodo]}{pago.metodo === "TARJETA" ? ` · ${NOMBRE_TARJETA[pago.tipoTarjeta || "QR"]}` : ""}</span>
                      <span>${formatearMoneda(pago.monto)}</span>
                    </div>
                  ))}
                </div>
              </div>
            </Card>
          );
        })}
      </section>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card className="overflow-hidden">
          <div className="border-b px-4 py-3 font-semibold dark:border-neutral-800">Cobros de cuenta corriente</div>
          {cobrosCuenta.length === 0 ? <div className="p-4 text-sm text-neutral-500">Sin cobros en este cierre.</div> : (
            <div className="divide-y divide-neutral-200 dark:divide-neutral-800">
              {cobrosCuenta.map((cobro, indice) => (
                <div key={cobro.id} className="flex items-center justify-between gap-3 px-4 py-3 text-sm">
                  <div><span className="font-medium">#{indice + 1} · {cobro.cliente.nombre}</span><div className="text-xs text-neutral-500">{formatearFechaHora(cobro.createdAt)} · {cobro.metodo ? NOMBRE_PAGO[cobro.metodo] : "Sin medio"}{cobro.notas ? ` · ${cobro.notas}` : ""}</div></div>
                  <span className="font-semibold">${formatearMoneda(cobro.monto)}</span>
                </div>
              ))}
            </div>
          )}
        </Card>

        <Card className="overflow-hidden">
          <div className="border-b px-4 py-3 font-semibold dark:border-neutral-800">Movimientos manuales de caja</div>
          {!control?.movimientos.length ? <div className="p-4 text-sm text-neutral-500">Sin ingresos ni egresos manuales.</div> : (
            <div className="divide-y divide-neutral-200 dark:divide-neutral-800">
              {control.movimientos.map((movimiento, indice) => (
                <div key={movimiento.id} className="flex items-center justify-between gap-3 px-4 py-3 text-sm">
                  <div><span className="font-medium">#{indice + 1} · {movimiento.concepto}</span><div className="text-xs text-neutral-500">{formatearFechaHora(movimiento.createdAt)} · {movimiento.operador}</div></div>
                  <span className={movimiento.tipo === "INGRESO" ? "font-semibold text-emerald-600" : "font-semibold text-red-600"}>
                    {movimiento.tipo === "INGRESO" ? "+" : "-"}${formatearMoneda(movimiento.monto)}
                  </span>
                </div>
              ))}
            </div>
          )}
        </Card>
      </div>
    </div>
  );
}
