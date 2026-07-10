"use client";

import { useEffect, useState, useMemo } from "react";
import Card from "@/components/ui/Card";
import Badge from "@/components/ui/Badge";
import Plegable from "@/components/ui/Plegable";
import { th, td, trHover } from "@/components/ui/styles";
import { formatearMoneda } from "@/lib/formato";

type Pago = { metodo: "EFECTIVO" | "TARJETA" | "TRANSFERENCIA" | "FIADO"; monto: number };
type PedidoItem = { id: number; productoId: number; cantidad: number; precioUnitario: number; subtotal: number; producto: { nombre: string } };
type Pedido = { id: number; items: PedidoItem[] };

type Venta = {
  id: number;
  tipo: "MOSTRADOR" | "MESA";
  mesaId: number | null;
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

  useEffect(() => {
    async function cargar() {
      const res = await fetch("/api/ventas");
      setVentas(await res.json());
      setLoading(false);
    }
    cargar();
  }, []);

  const hoy = useMemo(() => new Date().toDateString(), []);
  const ventasHoy = ventas.filter((v) => v.closedAt && new Date(v.closedAt).toDateString() === hoy);
  const mostrador = ventasHoy.filter((v) => v.tipo === "MOSTRADOR");
  const mesas = ventasHoy.filter((v) => v.tipo === "MESA");

  const totalHoy = ventasHoy.reduce((acc, v) => acc + v.total, 0);
  const descuentoTotal = ventasHoy.reduce((acc, v) => acc + (v.total * v.descuentoPct) / 100, 0);

  if (loading) return <div className="text-sm text-neutral-500">Cargando...</div>;

  return (
    <div className="max-w-5xl mx-auto flex flex-col gap-6">
      <h1 className="text-2xl font-semibold tracking-tight text-neutral-50">Ventas del día</h1>

      <Card className="p-4">
        <div className="grid grid-cols-3 gap-4">
          <div>
            <div className="text-xs text-neutral-500">Total de ventas</div>
            <div className="text-2xl font-semibold text-neutral-50">${formatearMoneda(totalHoy)}</div>
          </div>
          <div>
            <div className="text-xs text-neutral-500">Cantidad</div>
            <div className="text-2xl font-semibold text-neutral-50">{ventasHoy.length}</div>
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
                      </td>
                      <td className={td}>
                        <div className="flex gap-1 flex-wrap">
                          {v.pagos.map((p, i) => (
                            <Badge key={i} variant="neutral">
                              {p.metodo}
                            </Badge>
                          ))}
                        </div>
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
                  <div className="pt-2 border-t border-neutral-800 flex justify-between text-sm font-semibold">
                    <span>Total</span>
                    <div>
                      <span>${formatearMoneda(v.total)}</span>
                      {v.descuentoPct > 0 && <span className="text-xs text-red-400 ml-2">({v.descuentoPct}%)</span>}
                    </div>
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
