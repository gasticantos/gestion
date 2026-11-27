import { NextRequest, NextResponse } from "next/server";
import { conBloqueoCaja } from "@/lib/cajaManual";
import { sesionActual } from "@/lib/sesionServidor";
import { aplicarDescuento } from "@/lib/precio";
import { obtenerUsuarioIdDesdeRequest, registrarAuditoria } from "@/lib/auditoria";
import { formatearMoneda } from "@/lib/formato";

// Cobra solo algunos productos de una mesa (ej. 2 de las 4 cocas de alguien que se va)
// sin cerrar la cuenta. Esos productos pasan a una venta nueva ya cobrada y se descuentan
// de la cuenta de la mesa. El stock no se toca: ya se descontó al cargarlos en la mesa.

const METODOS = ["EFECTIVO", "TARJETA", "TRANSFERENCIA"] as const;
type GrupoInput = { itemIds: number[]; cantidad: number };

class ErrorCobro extends Error {
  constructor(mensaje: string, public status = 400) {
    super(mensaje);
  }
}

const redondear = (valor: number) => Math.round(valor * 100) / 100;

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const sesion = await sesionActual();
  if (!sesion || sesion.rol === "MOZO") {
    return NextResponse.json({ error: "No tenés permiso para cobrar" }, { status: 403 });
  }

  const { id } = await params;
  const body = await req.json().catch(() => ({}));
  const metodo = String(body.metodo || "") as (typeof METODOS)[number];
  const tipoTarjeta = metodo === "TARJETA" ? (String(body.tipoTarjeta || "QR") as "QR" | "DEBITO" | "CREDITO") : null;
  const grupos = (Array.isArray(body.grupos) ? body.grupos : []) as GrupoInput[];

  if (!METODOS.includes(metodo)) {
    return NextResponse.json({ error: "Elegí cómo paga" }, { status: 400 });
  }
  if (tipoTarjeta && !["QR", "DEBITO", "CREDITO"].includes(tipoTarjeta)) {
    return NextResponse.json({ error: "El tipo de tarjeta no es válido" }, { status: 400 });
  }
  const gruposValidos = grupos.filter((g) => Number(g?.cantidad) > 0);
  if (
    gruposValidos.length === 0 ||
    gruposValidos.some(
      (g) => !Array.isArray(g.itemIds) || g.itemIds.length === 0 || !Number.isFinite(Number(g.cantidad))
    )
  ) {
    return NextResponse.json({ error: "Elegí al menos un producto para cobrar" }, { status: 400 });
  }

  try {
    const resultado = await conBloqueoCaja(sesion.negocioId, async (tx) => {
      const mesa = await tx.mesa.findUnique({
        where: { id: Number(id) },
        include: {
          ventas: {
            where: { estado: "ABIERTA", negocioId: sesion.negocioId },
            include: { pagos: true, pedidos: { include: { items: { include: { producto: { select: { nombre: true } } } } } } },
          },
        },
      });
      const venta = mesa?.ventas[0];
      if (!mesa || !venta) throw new ErrorCobro("La mesa no tiene una cuenta abierta", 409);

      const itemsVenta = new Map(venta.pedidos.flatMap((p) => p.items).map((item) => [item.id, item]));

      // Para cada renglón elegido, se toma la cantidad de sus PedidoItem en orden.
      const aMover: { itemId: number; productoId: number; nombre: string; cantidad: number; precioUnitario: number }[] = [];
      for (const grupo of gruposValidos) {
        let restante = Number(grupo.cantidad);
        const items = grupo.itemIds.map((itemId) => itemsVenta.get(Number(itemId)));
        if (items.some((item) => !item)) {
          throw new ErrorCobro("La cuenta cambió. Actualizá la pantalla antes de cobrar.", 409);
        }
        const disponible = items.reduce((suma, item) => suma + item!.cantidad, 0);
        if (restante - disponible > 1e-9) {
          throw new ErrorCobro(`No hay tantas unidades de "${items[0]!.producto.nombre}" en la mesa`, 409);
        }
        for (const item of items) {
          if (restante <= 1e-9) break;
          const cantidad = Math.min(restante, item!.cantidad);
          aMover.push({
            itemId: item!.id,
            productoId: item!.productoId,
            nombre: item!.producto.nombre,
            cantidad,
            precioUnitario: item!.precioUnitario,
          });
          restante -= cantidad;
        }
      }

      const totalCobrado = redondear(aMover.reduce((suma, i) => suma + i.cantidad * i.precioUnitario, 0));
      const totalRestante = redondear(venta.total - totalCobrado);
      const quedanItems = [...itemsVenta.values()].some((item) => {
        const movido = aMover.filter((m) => m.itemId === item.id).reduce((s, m) => s + m.cantidad, 0);
        return item.cantidad - movido > 1e-9;
      });
      if (!quedanItems) {
        throw new ErrorCobro("Estás eligiendo todo lo de la mesa: para eso usá el cobro normal de la cuenta", 409);
      }
      const pagado = venta.pagos.reduce((suma, pago) => suma + pago.monto, 0);
      if (pagado - aplicarDescuento(totalRestante, venta.descuentoPct).total > 0.01) {
        throw new ErrorCobro("Lo que queda en la mesa sería menor a lo que ya se pagó a cuenta", 409);
      }

      for (const mover of aMover) {
        const item = itemsVenta.get(mover.itemId)!;
        if (item.cantidad - mover.cantidad <= 1e-9) {
          await tx.pedidoItem.delete({ where: { id: item.id } });
        } else {
          await tx.pedidoItem.update({
            where: { id: item.id },
            data: {
              cantidad: { decrement: mover.cantidad },
              subtotal: { decrement: mover.cantidad * mover.precioUnitario },
            },
          });
        }
      }
      await tx.venta.update({
        where: { id: venta.id },
        data: { total: { decrement: totalCobrado } },
      });

      const ventaCobrada = await tx.venta.create({
        data: {
          tipo: "MESA",
          estado: "CERRADA",
          closedAt: new Date(),
          mesaId: mesa.id,
          tarifa: venta.tarifa,
          total: totalCobrado,
          ticketImpreso: true,
          responsableCuentaId: venta.responsableCuentaId,
          responsableCuentaNombre: venta.responsableCuentaNombre,
          negocioId: sesion.negocioId,
          pedidos: {
            create: {
              creadoPorId: Number(sesion.sub),
              comandaImpresa: true,
              items: {
                create: aMover.map((m) => ({
                  productoId: m.productoId,
                  cantidad: m.cantidad,
                  precioUnitario: m.precioUnitario,
                  subtotal: m.cantidad * m.precioUnitario,
                })),
              },
            },
          },
          pagos: { create: { metodo, monto: totalCobrado, tipoTarjeta } },
        },
      });

      return { mesa, venta, ventaCobrada, aMover, totalCobrado };
    });

    const usuarioId = await obtenerUsuarioIdDesdeRequest(req);
    const detalle = resultado.aMover.map((m) => `${m.cantidad} x ${m.nombre}`).join(", ");
    await registrarAuditoria(
      usuarioId,
      "cobrar_items_mesa",
      `${resultado.mesa.apodo || resultado.mesa.nombre} · ${detalle} · ${metodo}: $${formatearMoneda(resultado.totalCobrado)} · Venta #${resultado.ventaCobrada.id} (de la cuenta #${resultado.venta.id})`
    );
    return NextResponse.json({ id: resultado.ventaCobrada.id, total: resultado.totalCobrado });
  } catch (error) {
    if (error instanceof ErrorCobro) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    console.error("Error cobrando productos de la mesa:", error);
    return NextResponse.json({ error: "No se pudieron cobrar los productos" }, { status: 500 });
  }
}
