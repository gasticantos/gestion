"use client";

import { useEffect, useState } from "react";
import Card from "@/components/ui/Card";
import Plegable from "@/components/ui/Plegable";
import Button from "@/components/ui/Button";
import { th, td, trHover, input } from "@/components/ui/styles";
import { formatearMoneda } from "@/lib/formato";

type MetodoPago = "EFECTIVO" | "TARJETA" | "TRANSFERENCIA" | "FIADO";
type Pago = { id: number; metodo: MetodoPago; monto: number };
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
      [venta.id]: actuales.map((p) => (p.id === pagoId ? { ...p, metodo } : p)),
    }));
    setMensaje(null);
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
        body: JSON.stringify({ pagos: pagos.map(({ id, metodo }) => ({ id, metodo })) }),
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

  function ControlesVenta({ venta }: { venta: Venta }) {
    const pagos = pagosEditados[venta.id] || venta.pagos;
    const modificado = Boolean(pagosEditados[venta.id]);
    return (
      <div className="flex flex-wrap items-center justify-end gap-2">
        <div className="flex flex-wrap gap-1">
          {pagos.map((p) => (
            <select
              key={p.id}
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
          ))}
        </div>
        {modificado && (
          <Button size="sm" variant="primary" onClick={() => guardarPagos(venta)} disabled={guardandoId === venta.id}>
            {guardandoId === venta.id ? "Guardando..." : "Guardar pago"}
          </Button>
        )}
        <Button size="sm" onClick={() => reimprimir(venta.id)} disabled={imprimiendoId === venta.id}>
          {imprimiendoId === venta.id ? "Enviando..." : "Reimprimir ticket"}
        </Button>
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
                    <th className={th}>Pago y acciones</th>
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
