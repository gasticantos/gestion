"use client";

import { useEffect, useState } from "react";
import Card from "@/components/ui/Card";
import Badge from "@/components/ui/Badge";
import Plegable from "@/components/ui/Plegable";
import Button from "@/components/ui/Button";
import { th, td, trHover, input } from "@/components/ui/styles";
import { formatearMoneda } from "@/lib/formato";

type MetodoPago = "EFECTIVO" | "TARJETA" | "TRANSFERENCIA" | "FIADO";
type TipoTarjeta = "QR" | "DEBITO" | "CREDITO";
type Pago = { id: number; metodo: MetodoPago; monto: number; tipoTarjeta?: TipoTarjeta | null };
type PedidoItem = { id: number; productoId: number; cantidad: number; precioUnitario: number; subtotal: number; producto: { nombre: string } };
type Pedido = { id: number; items: PedidoItem[] };

type Venta = {
  id: number;
  tipo: "MOSTRADOR" | "MESA";
  mesaId: number | null;
  clienteId: number | null;
  mesa?: { nombre: string };
  total: number;
  descuentoPct: number;
  propina: number;
  closedAt: string | null;
  createdAt: string;
  pedidos: Pedido[];
  pagos: Pago[];
};

export default function VentasPage() {
  const [ventas, setVentas] = useState<Venta[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [pagosEditados, setPagosEditados] = useState<Record<number, Pago[]>>({});
  const [guardandoId, setGuardandoId] = useState<number | null>(null);
  const [imprimiendoId, setImprimiendoId] = useState<number | null>(null);
  const [eliminandoId, setEliminandoId] = useState<number | null>(null);
  const [editandoId, setEditandoId] = useState<number | null>(null);
  const [mensaje, setMensaje] = useState<{ tipo: "ok" | "error"; texto: string } | null>(null);

  useEffect(() => {
    async function cargar() {
      try {
        const res = await fetch("/api/ventas", { cache: "no-store" });
        const data = await res.json().catch(() => null);
        if (!res.ok || !Array.isArray(data)) {
          setError(data?.error || "No se pudo cargar el listado de ventas");
          return;
        }
        setVentas(data);
      } catch {
        setError("No se pudo conectar para cargar las ventas");
      } finally {
        setLoading(false);
      }
    }
    cargar();
  }, []);

  // La API ya devuelve exclusivamente la jornada comercial vigente (07:00 a 06:59)
  // y excluye lo archivado por un cierre manual. No volver a filtrar por fecha calendario:
  // hacerlo reiniciaba visualmente todo a medianoche aunque la caja siguiera abierta.
  const ventasJornada = ventas;
  const mostrador = ventasJornada.filter((v) => v.tipo === "MOSTRADOR");
  const mesas = ventasJornada.filter((v) => v.tipo === "MESA");

  const totalJornada = ventasJornada.reduce((acc, v) => acc + v.total, 0);
  const descuentoTotal = ventasJornada.reduce((acc, v) => acc + (v.total * v.descuentoPct) / 100, 0);

  function cambiarMetodo(venta: Venta, pagoId: number, metodo: MetodoPago) {
    const actuales = pagosEditados[venta.id] || venta.pagos;
    setPagosEditados((prev) => ({
      ...prev,
      [venta.id]: actuales.map((p) => (p.id === pagoId ? { ...p, metodo, tipoTarjeta: metodo === "TARJETA" ? p.tipoTarjeta || "QR" : null } : p)),
    }));
    setMensaje(null);
  }

  function cambiarTipoTarjeta(venta: Venta, pagoId: number, tipoTarjeta: TipoTarjeta) {
    const actuales = pagosEditados[venta.id] || venta.pagos;
    setPagosEditados((prev) => ({
      ...prev,
      [venta.id]: actuales.map((p) => (p.id === pagoId ? { ...p, tipoTarjeta } : p)),
    }));
  }

  async function guardarPagos(venta: Venta) {
    const pagos = pagosEditados[venta.id];
    if (!pagos) return;
    setGuardandoId(venta.id);
    setMensaje(null);
    try {
      const res = await fetch(`/api/ventas/${venta.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ pagos: pagos.map(({ id, metodo, tipoTarjeta }) => ({ id, metodo, tipoTarjeta: metodo === "TARJETA" ? tipoTarjeta || "QR" : null })) }),
      });
      const data = await res.json().catch(() => null);
      if (!res.ok) throw new Error(data?.error || "No se pudo modificar el pago");
      setVentas((actuales) =>
        actuales.map((v) => (v.id === venta.id ? { ...v, pagos: data.pagos } : v))
      );
      setPagosEditados((prev) => {
        const siguiente = { ...prev };
        delete siguiente[venta.id];
        return siguiente;
      });
      setEditandoId(null);
      setMensaje({ tipo: "ok", texto: `Método de pago de la venta #${venta.id} actualizado.` });
    } catch (err) {
      setMensaje({ tipo: "error", texto: err instanceof Error ? err.message : "No se pudo modificar el pago" });
    } finally {
      setGuardandoId(null);
    }
  }

  async function reimprimir(ventaId: number) {
    setImprimiendoId(ventaId);
    setMensaje(null);
    try {
      const res = await fetch(`/api/ventas/${ventaId}/imprimir`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      });
      const data = await res.json().catch(() => null);
      if (!res.ok) throw new Error(data?.error || "No se pudo reimprimir el ticket");
      setMensaje({ tipo: "ok", texto: `Ticket de la venta #${ventaId} enviado a impresión.` });
    } catch (err) {
      setMensaje({ tipo: "error", texto: err instanceof Error ? err.message : "No se pudo reimprimir el ticket" });
    } finally {
      setImprimiendoId(null);
    }
  }

  async function eliminarVenta(venta: Venta) {
    const confirmado = window.confirm(
      `¿Eliminar definitivamente la venta #${venta.id}?\n\nLos productos volverán al stock y se revertirá cualquier cargo en cuenta corriente.`
    );
    if (!confirmado) return;

    setEliminandoId(venta.id);
    setMensaje(null);
    try {
      const res = await fetch(`/api/ventas/${venta.id}`, { method: "DELETE" });
      const data = await res.json().catch(() => null);
      if (!res.ok) throw new Error(data?.error || "No se pudo eliminar la venta");
      setVentas((actuales) => actuales.filter((item) => item.id !== venta.id));
      setPagosEditados((prev) => {
        const siguiente = { ...prev };
        delete siguiente[venta.id];
        return siguiente;
      });
      setEditandoId(null);
      setMensaje({ tipo: "ok", texto: `Venta #${venta.id} eliminada y stock restaurado.` });
    } catch (err) {
      setMensaje({ tipo: "error", texto: err instanceof Error ? err.message : "No se pudo eliminar la venta" });
    } finally {
      setEliminandoId(null);
    }
  }

  function ControlesVenta({ venta }: { venta: Venta }) {
    const pagos = pagosEditados[venta.id] || venta.pagos;
    const modificado = Boolean(pagosEditados[venta.id]);
    const editando = editandoId === venta.id;
    return (
      <div className="flex flex-col items-end gap-2">
        <div className="flex flex-wrap items-center justify-end gap-2">
          <div className="flex flex-wrap gap-1">
            {venta.pagos.map((p) => (
              <Badge key={p.id} variant="neutral">{p.metodo}{p.metodo === "TARJETA" ? ` · ${p.tipoTarjeta === "DEBITO" ? "DÉBITO" : p.tipoTarjeta === "CREDITO" ? "CRÉDITO" : "QR"}` : ""}</Badge>
            ))}
          </div>
          <button
            type="button"
            className="px-1 py-1 text-sm font-medium text-red-500 transition-colors hover:text-red-400 disabled:opacity-40"
            onClick={() => {
              setEditandoId(editando ? null : venta.id);
              if (editando) {
                setPagosEditados((prev) => {
                  const siguiente = { ...prev };
                  delete siguiente[venta.id];
                  return siguiente;
                });
              }
              setMensaje(null);
            }}
          >
            {editando ? "Cancelar" : "Editar"}
          </button>
          <button
            type="button"
            className="px-1 py-1 text-sm font-medium text-blue-500 transition-colors hover:text-blue-400 disabled:opacity-40"
            onClick={() => reimprimir(venta.id)}
            disabled={imprimiendoId === venta.id}
          >
            {imprimiendoId === venta.id ? "Enviando..." : "Reimprimir ticket"}
          </button>
        </div>
        {editando && (
          <div className="flex flex-wrap items-center justify-end gap-2 rounded-lg border border-neutral-200 bg-neutral-50 p-2 dark:border-neutral-700 dark:bg-neutral-900">
            {pagos.map((p) => (
              <div key={p.id} className="flex gap-1">
                <select
                aria-label={`Método de pago de $${formatearMoneda(p.monto)}`}
                className={`${input} py-1.5 text-xs min-w-32`}
                value={p.metodo}
                onChange={(e) => cambiarMetodo(venta, p.id, e.target.value as MetodoPago)}
              >
                <option value="EFECTIVO">Efectivo</option>
                <option value="TARJETA">Tarjeta</option>
                <option value="TRANSFERENCIA">Transferencia</option>
                <option value="FIADO" disabled={!venta.clienteId}>Cuenta corriente</option>
                </select>
                {p.metodo === "TARJETA" && (
                  <select className={`${input} py-1.5 text-xs min-w-24`} value={p.tipoTarjeta || "QR"} onChange={(e) => cambiarTipoTarjeta(venta, p.id, e.target.value as TipoTarjeta)}>
                    <option value="QR">QR</option><option value="DEBITO">Débito</option><option value="CREDITO">Crédito</option>
                  </select>
                )}
              </div>
            ))}
            <Button size="sm" variant="primary" onClick={() => guardarPagos(venta)} disabled={!modificado || guardandoId === venta.id}>
              {guardandoId === venta.id ? "Guardando..." : "Guardar"}
            </Button>
            <button
              type="button"
              className="px-2 py-1.5 text-sm font-semibold text-red-600 transition-colors hover:text-red-500 disabled:opacity-40"
              onClick={() => eliminarVenta(venta)}
              disabled={eliminandoId === venta.id}
            >
              {eliminandoId === venta.id ? "Eliminando..." : "Eliminar venta"}
            </button>
          </div>
        )}
      </div>
    );
  }

  if (loading) return <div className="text-sm text-neutral-500">Cargando...</div>;
  if (error) {
    return <div className="rounded-lg border border-red-300 bg-red-50 p-4 text-sm text-red-700">{error}</div>;
  }

  return (
    <div className="max-w-5xl mx-auto flex flex-col gap-6">
      <h1 className="text-2xl font-semibold tracking-tight text-neutral-900 dark:text-neutral-50">Ventas de la jornada</h1>

      {mensaje && (
        <div className={`rounded-lg border p-3 text-sm ${mensaje.tipo === "ok" ? "border-green-300 bg-green-50 text-green-800 dark:border-green-900 dark:bg-green-950/40 dark:text-green-300" : "border-red-300 bg-red-50 text-red-700 dark:border-red-900 dark:bg-red-950/40 dark:text-red-300"}`}>
          {mensaje.texto}
        </div>
      )}

      <Card className="p-4">
        <div className="grid grid-cols-3 gap-4">
          <div>
            <div className="text-xs text-neutral-500">Total de ventas</div>
            <div className="text-2xl font-semibold text-neutral-900 dark:text-neutral-50">${formatearMoneda(totalJornada)}</div>
          </div>
          <div>
            <div className="text-xs text-neutral-500">Cantidad</div>
            <div className="text-2xl font-semibold text-neutral-900 dark:text-neutral-50">{ventasJornada.length}</div>
          </div>
          <div>
            <div className="text-xs text-neutral-500">Descuentos aplicados</div>
            <div className="text-2xl font-semibold text-red-400">-${formatearMoneda(descuentoTotal)}</div>
          </div>
        </div>
      </Card>

      <div className="flex flex-col gap-3">
        <Plegable titulo={`Mostrador (${mostrador.length})`} abierto={true}>
          {mostrador.length === 0 ? (
            <div className="text-sm text-neutral-500">Sin ventas</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr>
                    <th className={th}>Hora</th>
                    <th className={th}>Productos</th>
                    <th className={th}>Total</th>
                    <th className={th}>Métodos de pago</th>
                  </tr>
                </thead>
                <tbody>
                  {mostrador.map((v) => (
                    <tr key={v.id} className={trHover}>
                      <td className={td}>{new Date(v.closedAt!).toLocaleTimeString("es-AR")}</td>
                      <td className={td}>
                        <div className="text-xs space-y-1">
                          {v.pedidos.flatMap((p) => p.items).map((item, i) => (
                            <div key={i}>
                              {item.producto.nombre} × {item.cantidad}
                            </div>
                          ))}
                        </div>
                      </td>
                      <td className={td}>
                        <span className="font-semibold">${formatearMoneda(v.total)}</span>
                        {v.descuentoPct > 0 && <span className="text-xs text-red-400 ml-1">({v.descuentoPct}%)</span>}
                        {v.propina > 0 && <span className="block text-xs text-violet-500">+ ${formatearMoneda(v.propina)} propina</span>}
                      </td>
                      <td className={td}>
                        <ControlesVenta venta={v} />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Plegable>

        <Plegable titulo={`Mesas (${mesas.length})`} abierto={true}>
          {mesas.length === 0 ? (
            <div className="text-sm text-neutral-500">Sin ventas</div>
          ) : (
            <div className="flex flex-col gap-2">
              {mesas.map((v) => (
                <Plegable key={v.id} titulo={`Mesa ${v.mesa?.nombre || "?"} - ${new Date(v.closedAt!).toLocaleTimeString("es-AR")} - $${formatearMoneda(v.total)}`}>
                  <table className="w-full text-xs">
                    <thead>
                      <tr>
                        <th className={th}>Producto</th>
                        <th className={`${th} w-12`}>Cant.</th>
                        <th className={`${th} w-20`}>Precio</th>
                        <th className={`${th} w-20`}>Subtotal</th>
                      </tr>
                    </thead>
                    <tbody>
                      {v.pedidos.map((pedido) =>
                        pedido.items.map((item) => (
                          <tr key={item.id} className={trHover}>
                            <td className={td}>{item.producto.nombre}</td>
                            <td className={td}>{item.cantidad}</td>
                            <td className={td}>${formatearMoneda(item.precioUnitario)}</td>
                            <td className={td}>${formatearMoneda(item.subtotal)}</td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                  <div className="pt-2 border-t border-neutral-200 dark:border-neutral-800 flex justify-between text-sm font-semibold">
                    <span>Total</span>
                    <div>
                      <span>${formatearMoneda(v.total)}</span>
                      {v.descuentoPct > 0 && <span className="text-xs text-red-400 ml-2">({v.descuentoPct}%)</span>}
                    </div>
                  </div>
                  <div className="pt-3">
                    <ControlesVenta venta={v} />
                  </div>
                </Plegable>
              ))}
            </div>
          )}
        </Plegable>
      </div>
    </div>
  );
}
