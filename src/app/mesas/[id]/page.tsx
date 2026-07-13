"use client";

import { Fragment, useEffect, useMemo, useRef, useState, use } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import BuscadorProducto, { ProductoBusqueda } from "@/components/BuscadorProducto";
import PagoSelector, {
  PagoLinea,
  ClienteOpcion,
  pagosCuadran,
  requiereCliente,
  resolvePagos,
} from "@/components/PagoSelector";
import Card from "@/components/ui/Card";
import Button from "@/components/ui/Button";
import Badge from "@/components/ui/Badge";
import { th, td, trHover } from "@/components/ui/styles";
import { Tarifa, aplicarDescuento } from "@/lib/precio";
import { formatearMoneda } from "@/lib/formato";

type Producto = ProductoBusqueda & { stock: number };

type PedidoItem = {
  id: number;
  productoId: number;
  cantidad: number;
  precioUnitario: number;
  subtotal: number;
  producto: { nombre: string };
};

type Pedido = { id: number; createdAt: string; items: PedidoItem[] };

type Venta = { id: number; total: number; pedidos: Pedido[]; borradorRonda: ItemRonda[] | null };

type Mesa = {
  id: number;
  nombre: string;
  estado: "LIBRE" | "OCUPADA";
  ventas: Venta[];
};

type ItemRonda = {
  productoId: number;
  nombre: string;
  tarifa: Tarifa;
  precioUnitario: number;
  cantidad: number;
  stockDisponible: number;
};

export default function MesaDetallePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const router = useRouter();
  const [mesa, setMesa] = useState<Mesa | null>(null);
  const [productos, setProductos] = useState<Producto[]>([]);
  const [clientes, setClientes] = useState<ClienteOpcion[]>([]);
  const [ronda, setRonda] = useState<ItemRonda[]>([]);
  const [pagos, setPagos] = useState<PagoLinea[]>([{ metodo: "EFECTIVO", monto: "0" }]);
  const [clienteId, setClienteId] = useState("");
  const [descuentoPct, setDescuentoPct] = useState("0");
  const [error, setError] = useState("");
  const [enviando, setEnviando] = useState(false);
  const [recargoMesaPct, setRecargoMesaPct] = useState(0);
  const [rol, setRol] = useState<string | null>(null);
  const [editandoItemId, setEditandoItemId] = useState<number | null>(null);
  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const [itemsActualizados, setItemsActualizados] = useState<Map<number, number>>(new Map());
  const [preciosActualizados, setPreciosActualizados] = useState<Map<number, number>>(new Map());
  const [ticketImpreso, setTicketImpreso] = useState(false);
  const [editandoItems, setEditandoItems] = useState<Set<number>>(new Set());

  useEffect(() => {
    fetch("/api/auth/me")
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => setRol(data?.rol ?? null));
  }, []);

  async function cargar() {
    const [mesaRes, cliRes, configRes] = await Promise.all([
      fetch(`/api/mesas/${id}`),
      fetch("/api/clientes"),
      fetch("/api/configuracion"),
    ]);
    setMesa(await mesaRes.json());
    setClientes(await cliRes.json());
    setRecargoMesaPct((await configRes.json()).recargoMesaPct);
  }

  // Carga productos después de los datos críticos
  const cargarProductos = async () => {
    const prodRes = await fetch("/api/productos");
    setProductos((await prodRes.json()).filter((p: { activo: boolean }) => p.activo));
  };

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- recarga al cambiar de mesa
    cargar();
    cargarProductos();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  // El pedido en curso se guarda en Supabase (Venta.borradorRonda), no en el navegador: así se ve
  // en tiempo real desde cualquier dispositivo que tenga abierta la misma mesa.
  const ultimoCambioLocalRef = useRef(0);
  const ultimoSincronizadoRef = useRef("[]");

  useEffect(() => {
    const guardado = mesa?.ventas[0]?.borradorRonda ?? [];
    ultimoSincronizadoRef.current = JSON.stringify(guardado);
    // eslint-disable-next-line react-hooks/set-state-in-effect -- restaura el borrador compartido al abrir la mesa
    setRonda(guardado);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mesa?.ventas[0]?.id]);

  // Guarda el borrador en Supabase (con debounce) cada vez que se toca la ronda en este dispositivo.
  useEffect(() => {
    if (!mesa || mesa.estado !== "OCUPADA") return;
    const json = JSON.stringify(ronda);
    if (json === ultimoSincronizadoRef.current) return;
    const t = setTimeout(() => {
      ultimoSincronizadoRef.current = json;
      fetch(`/api/mesas/${id}/borrador`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ronda }),
      });
    }, 600);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ronda, id, mesa?.estado]);

  // Sondea la mesa cada pocos segundos para ver pedidos/borrador que hayan cargado otros dispositivos.
  useEffect(() => {
    const t = setInterval(async () => {
      const res = await fetch(`/api/mesas/${id}`);
      if (!res.ok) return;
      const data: Mesa = await res.json();
      setMesa(data);
      const remoto = data.ventas[0]?.borradorRonda ?? [];
      const json = JSON.stringify(remoto);
      const inactivoLocal = Date.now() - ultimoCambioLocalRef.current > 3000;
      if (inactivoLocal && json !== ultimoSincronizadoRef.current) {
        ultimoSincronizadoRef.current = json;
        setRonda(remoto);
      }
    }, 4000);
    return () => clearInterval(t);
  }, [id]);

  const venta = mesa?.ventas[0];
  const total = venta?.total ?? 0;
  const descuento = useMemo(() => aplicarDescuento(total, Number(descuentoPct)), [total, descuentoPct]);
  const totalFinal = descuento.total;

  const totalRonda = useMemo(() => ronda.reduce((acc, i) => acc + i.precioUnitario * i.cantidad, 0), [ronda]);

  async function agregarARonda(p: ProductoBusqueda, tarifa: Tarifa, precioUnitario: number) {
    const producto = productos.find((x) => x.id === p.id);
    if (!producto) return;
    ultimoCambioLocalRef.current = Date.now();

    // Buscar si ya existe en algún pedido guardado
    const pedidoConItem = venta?.pedidos.find((pedido) =>
      pedido.items.some((item) => item.productoId === p.id)
    );
    if (pedidoConItem) {
      const item = pedidoConItem.items.find((item) => item.productoId === p.id);
      if (item) {
        actualizarItemPedido(item.id, item.cantidad + 1);
        return;
      }
    }

    // Agregar a ronda temporal y enviar inmediatamente
    const itemRonda = {
      productoId: producto.id,
      nombre: producto.nombre,
      tarifa,
      precioUnitario,
      cantidad: 1,
      stockDisponible: producto.stock,
    };

    const rondaActual = ronda.find((i) => i.productoId === p.id && i.tarifa === tarifa)
      ? ronda.map((i) => (i.productoId === p.id && i.tarifa === tarifa ? { ...i, cantidad: i.cantidad + 1 } : i))
      : [...ronda, itemRonda];

    // Enviar inmediatamente (sin ronda temporal)
    setError("");
    setEnviando(true);
    const res = await fetch(`/api/mesas/${id}/pedido`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        items: rondaActual.map((i) => ({ productoId: i.productoId, cantidad: i.cantidad, tarifa: i.tarifa })),
      }),
    });
    setEnviando(false);
    if (!res.ok) {
      setError("Error al agregar producto");
      return;
    }
    ultimoSincronizadoRef.current = "[]";
    setRonda([]);
    await cargar();
  }

  function cambiarCantidad(productoId: number, tarifa: Tarifa, cantidad: number) {
    ultimoCambioLocalRef.current = Date.now();
    setRonda((prev) =>
      prev
        .map((i) => (i.productoId === productoId && i.tarifa === tarifa ? { ...i, cantidad: Math.max(0, cantidad) } : i))
        .filter((i) => i.cantidad > 0)
    );
  }

  function quitarDeRonda(productoId: number, tarifa: Tarifa) {
    ultimoCambioLocalRef.current = Date.now();
    setRonda((prev) => prev.filter((i) => !(i.productoId === productoId && i.tarifa === tarifa)));
  }

  function actualizarItemPedido(itemId: number, cantidad?: number, precioUnitario?: number) {
    if (cantidad !== undefined && cantidad <= 0) return;
    // Actualizar local inmediatamente (sin esperar)
    if (cantidad !== undefined) setItemsActualizados((prev) => new Map(prev).set(itemId, cantidad));
    if (precioUnitario !== undefined) setPreciosActualizados((prev) => new Map(prev).set(itemId, precioUnitario));

    // Cancelar timer anterior
    if (timerRef.current) clearTimeout(timerRef.current);

    // Enviar al servidor sin esperar (debounce 500ms)
    timerRef.current = setTimeout(() => {
      const body: { cantidad?: number; precioUnitario?: number } = {};
      if (cantidad !== undefined) body.cantidad = cantidad;
      if (precioUnitario !== undefined) body.precioUnitario = precioUnitario;
      fetch(`/api/pedidos/item/${itemId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      }).catch(() => {
        // Si falla, no importa por ahora
      });
    }, 500);
  }

  function eliminarItemPedido(itemId: number) {
    // Actualizar local inmediatamente
    setMesa((prev) => {
      if (!prev) return prev;
      return {
        ...prev,
        ventas: prev.ventas.map((v) => ({
          ...v,
          pedidos: v.pedidos.map((p) => ({
            ...p,
            items: p.items.filter((i) => i.id !== itemId),
          })),
        })),
      };
    });

    // Enviar al servidor en background sin esperar
    fetch(`/api/pedidos/item/${itemId}`, { method: "DELETE" }).catch(() => {
      // Si falla, recargar
      cargar();
    });
  }

  async function abrirMesa() {
    setError("");
    const res = await fetch(`/api/mesas/${id}/abrir`, { method: "POST" });
    if (!res.ok) {
      const data = await res.json();
      setError(data.error || "Ocurrió un error");
      return;
    }
    await cargar();
  }

  async function enviarPedido(imprimirComanda: boolean) {
    setError("");
    if (ronda.length === 0) {
      setError("Agregá al menos un producto");
      return;
    }
    setEnviando(true);
    const res = await fetch(`/api/mesas/${id}/pedido`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        items: ronda.map((i) => ({ productoId: i.productoId, cantidad: i.cantidad, tarifa: i.tarifa })),
      }),
    });
    setEnviando(false);
    if (!res.ok) {
      const data = await res.json();
      setError(data.error || "Ocurrió un error");
      return;
    }
    const pedido = await res.json();
    if (imprimirComanda) {
      await fetch(`/api/pedidos/${pedido.id}/imprimir`, { method: "POST" });
    }
    ultimoSincronizadoRef.current = "[]";
    setRonda([]);
    await cargar();
  }

  async function imprimirTicket() {
    setError("");
    if (!venta) return;
    setEnviando(true);
    // Imprimir ticket de la venta completa
    await fetch(`/api/ventas/${venta.id}/imprimir`, { method: "POST" });
    setTicketImpreso(true);
    setEnviando(false);
  }

  async function cerrarMesa() {
    setError("");
    if (!pagosCuadran(pagos, totalFinal)) {
      setError("El total pagado no coincide con el total de la cuenta");
      return;
    }
    if (requiereCliente(pagos) && !clienteId) {
      setError("Elegí un cliente para la parte fiada");
      return;
    }
    const pagosFinales = resolvePagos(pagos, totalFinal);
    setEnviando(true);
    const res = await fetch(`/api/mesas/${id}/cerrar`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        pagos: pagosFinales.map((p) => ({ metodo: p.metodo, monto: Number(p.monto) })),
        clienteId: requiereCliente(pagos) ? Number(clienteId) : null,
        descuentoPct: Number(descuentoPct) || 0,
      }),
    });
    setEnviando(false);
    if (!res.ok) {
      const data = await res.json();
      setError(data.error || "Ocurrió un error");
      return;
    }
    const ventaCerrada = await res.json();
    // Imprimir ticket automáticamente sin navegar
    await fetch(`/api/ventas/${ventaCerrada.id}/imprimir`, { method: "POST" }).catch(() => {});
    // Volver a mesas
    router.push("/mesas");
  }

  if (!mesa) {
    return <div className="text-sm text-neutral-500">Cargando...</div>;
  }

  return (
    <div className="max-w-5xl mx-auto flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold tracking-tight text-neutral-50">Mesa {mesa.nombre}</h1>
        <Link href="/mesas" className="text-sm text-neutral-400 hover:text-neutral-200">
          Volver a mesas
        </Link>
      </div>

      {error && <div className="text-sm text-red-400">{error}</div>}

      {mesa.estado === "LIBRE" ? (
        <Button onClick={abrirMesa} variant="primary" className="self-start">
          Abrir mesa
        </Button>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="flex flex-col gap-3">
            <Card>
              <div className="p-3 border-b border-neutral-800 text-sm text-neutral-400">
                Productos cargados ({venta?.pedidos.reduce((acc, p) => acc + p.items.length, 0) ?? 0})
              </div>
              {!venta?.pedidos.length && ronda.length === 0 ? (
                <div className="p-4 text-sm text-neutral-500">Sin productos cargados todavía</div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr>
                        <th className={th}>Producto</th>
                        <th className={`${th} w-16`}>Cant.</th>
                        <th className={`${th} w-20`}>Precio</th>
                        <th className={`${th} w-24`}>Subtotal</th>
                        <th className={th}></th>
                      </tr>
                    </thead>
                    <tbody>
                      {venta?.pedidos.flatMap((pedido) =>
                        pedido.items.map((item) => {
                          const cantidadActual = itemsActualizados.get(item.id) ?? item.cantidad;
                          const precioActual = preciosActualizados.get(item.id) ?? item.precioUnitario;
                          return (
                            <tr key={item.id} className={trHover}>
                              <td className={td}>{item.producto.nombre}</td>
                              <td className={td}>
                                {editandoItems.has(item.id) ? (
                                  <input
                                    type="number"
                                    autoFocus
                                    className="w-12 rounded border border-blue-600 bg-neutral-950 px-1 py-0.5 text-sm text-neutral-100 focus:outline-none focus:ring-1 focus:ring-blue-600/50"
                                    value={cantidadActual}
                                    onChange={(e) => {
                                      const val = e.target.value;
                                      if (val === "") {
                                        setItemsActualizados((prev) => new Map(prev).set(item.id, 0));
                                      } else {
                                        const num = Number(val);
                                        if (!isNaN(num) && num > 0) {
                                          actualizarItemPedido(item.id, num);
                                        }
                                      }
                                    }}
                                    onBlur={() => {
                                      if (cantidadActual === 0) {
                                        actualizarItemPedido(item.id, item.cantidad);
                                      }
                                      setEditandoItems((s) => { const n = new Set(s); n.delete(item.id); return n; });
                                    }}
                                  />
                                ) : (
                                  <div className="flex items-center gap-1.5">
                                    <span className="text-sm font-medium">{cantidadActual}x</span>
                                    <button
                                      className="text-xs px-2 py-0.5 rounded border border-blue-600/50 text-blue-400 hover:bg-blue-600/10"
                                      onClick={() => setEditandoItems((s) => new Set(s).add(item.id))}
                                    >
                                      Editar
                                    </button>
                                  </div>
                                )}
                              </td>
                              <td className={td}>
                                {editandoItems.has(item.id) ? (
                                  <input
                                    type="number"
                                    step="0.01"
                                    className="w-20 rounded border border-blue-600 bg-neutral-950 px-1 py-0.5 text-sm text-neutral-100 focus:outline-none focus:ring-1 focus:ring-blue-600/50"
                                    value={precioActual}
                                    onChange={(e) => actualizarItemPedido(item.id, undefined, Number(e.target.value) || 0)}
                                  />
                                ) : (
                                  <span>${formatearMoneda(precioActual)}</span>
                                )}
                              </td>
                              <td className={td}>${formatearMoneda(precioActual * cantidadActual)}</td>
                              <td className={`${td} text-right`}>
                                <button
                                  className="text-red-400 hover:text-red-300 text-xs"
                                  onClick={() => eliminarItemPedido(item.id)}
                                >
                                  Quitar
                                </button>
                              </td>
                            </tr>
                          );
                        })
                      )}
                      {ronda.map((i) => (
                        <tr key={`${i.productoId}-${i.tarifa}`} className={trHover}>
                          <td className={td}>
                            {i.nombre}
                            <Badge variant={i.tarifa === "MESA" ? "accent" : "neutral"} className="ml-1">
                              {i.tarifa === "MESA" ? "Mesa" : "Mostrador"}
                            </Badge>
                          </td>
                          <td className={`${td} text-center`}>
                            <div className="flex items-center justify-center gap-1">
                              <button
                                className="w-6 h-6 text-xs rounded border border-neutral-700 hover:bg-neutral-800"
                                onClick={() => cambiarCantidad(i.productoId, i.tarifa, Math.max(1, i.cantidad - 1))}
                              >
                                −
                              </button>
                              <input
                                type="number"
                                inputMode="numeric"
                                className="w-12 text-center rounded border border-neutral-700 bg-neutral-950 px-1 py-0.5 text-sm text-neutral-100 focus:outline-none focus:ring-1 focus:ring-blue-600/50"
                                value={i.cantidad}
                                onChange={(e) => cambiarCantidad(i.productoId, i.tarifa, Number(e.target.value) || 1)}
                              />
                              <button
                                className="w-6 h-6 text-xs rounded border border-neutral-700 hover:bg-neutral-800"
                                onClick={() => cambiarCantidad(i.productoId, i.tarifa, i.cantidad + 1)}
                              >
                                +
                              </button>
                            </div>
                          </td>
                          <td className={td}>${formatearMoneda(i.precioUnitario)}</td>
                          <td className={td}>${formatearMoneda(i.precioUnitario * i.cantidad)}</td>
                          <td className={`${td} text-right`}>
                            <button
                              className="text-red-400 hover:text-red-300 text-xs"
                              onClick={() => quitarDeRonda(i.productoId, i.tarifa)}
                            >
                              Quitar
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
              <div className="p-3 border-t border-neutral-800 flex justify-between font-semibold text-neutral-100">
                <span>Total</span>
                <span>${formatearMoneda(total)}</span>
              </div>
            </Card>

            <Card className="p-4 flex flex-col gap-3">
              <div className="text-sm text-neutral-400">Agregar más productos</div>
              <BuscadorProducto
                productos={productos}
                onSeleccionar={agregarARonda}
                recargoMesaPct={recargoMesaPct}
              />
            </Card>
          </div>

          {rol !== "MOZO" && (
            <Card className="p-4 flex flex-col gap-3 self-start">
              <div className="flex justify-between items-baseline text-sm">
                <span className="text-neutral-500">Subtotal</span>
                <span className="text-neutral-300">${formatearMoneda(total)}</span>
              </div>
              <div className="flex items-center justify-between gap-2">
                <label className="text-xs text-neutral-500 flex items-center gap-1.5">
                  Descuento
                  <input
                    type="number"
                    min="0"
                    max="100"
                    step="0.1"
                    value={descuentoPct}
                    onChange={(e) => setDescuentoPct(e.target.value)}
                    className="w-14 rounded border border-neutral-700 bg-neutral-950 px-1.5 py-0.5 text-xs text-neutral-200 focus:outline-none focus:ring-2 focus:ring-blue-600/50"
                  />
                  %
                </label>
                {descuento.monto > 0 && (
                  <span className="text-xs font-medium text-red-400">-${formatearMoneda(descuento.monto)}</span>
                )}
              </div>
              <div className="flex justify-between items-baseline pt-1 border-t border-neutral-800">
                <span className="text-neutral-400">Total a cobrar</span>
                <span className="text-2xl font-semibold text-neutral-50">${formatearMoneda(totalFinal)}</span>
              </div>
              {!ticketImpreso ? (
                <Button
                  onClick={imprimirTicket}
                  disabled={enviando || totalFinal <= 0}
                  variant="primary"
                  className="w-full py-2.5"
                >
                  Imprimir ticket
                </Button>
              ) : (
                <>
                  <div className="text-sm text-blue-500 bg-blue-600/10 border border-blue-600/30 rounded-lg px-3 py-2">
                    ✓ Ticket impreso - Ahora selecciona cómo cobrar
                  </div>
                  <PagoSelector
                    total={totalFinal}
                    pagos={pagos}
                    setPagos={setPagos}
                    clientes={clientes}
                    clienteId={clienteId}
                    setClienteId={setClienteId}
                  />
                  <div className="flex gap-2">
                    <Button
                      onClick={() => setTicketImpreso(false)}
                      disabled={enviando}
                      variant="secondary"
                      className="flex-1"
                    >
                      Volver
                    </Button>
                    <Button
                      onClick={cerrarMesa}
                      disabled={enviando || totalFinal <= 0 || !pagosCuadran(pagos, totalFinal)}
                      variant="primary"
                      className="flex-1"
                    >
                      Cobrar y cerrar
                    </Button>
                  </div>
                </>
              )}
            </Card>
          )}
        </div>
      )}
    </div>
  );
}
