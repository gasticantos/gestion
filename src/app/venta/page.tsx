"use client";

import { useEffect, useMemo, useState } from "react";
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

type ItemCarrito = {
  productoId: number;
  nombre: string;
  tarifa: Tarifa;
  precioUnitario: number;
  cantidad: number;
  stockDisponible: number;
};

type BorradorVenta = {
  carrito: ItemCarrito[];
  pagos: PagoLinea[];
  clienteId: string;
  descuentoPct: string;
  descuentoResponsable: string;
  propina: string;
  error: string;
};

const CLAVE_BORRADORES = "ventas-mostrador-borradores";

function borradorVacio(): BorradorVenta {
  return {
    carrito: [],
    pagos: [{ metodo: "EFECTIVO", monto: "0" }],
    clienteId: "",
    descuentoPct: "",
    descuentoResponsable: "",
    propina: "",
    error: "",
  };
}

export default function VentaPage() {
  const [clientes, setClientes] = useState<ClienteOpcion[]>([]);
  const [borradores, setBorradores] = useState<BorradorVenta[]>(() =>
    Array.from({ length: 3 }, borradorVacio)
  );
  const [ventaActiva, setVentaActiva] = useState(0);
  const [restaurado, setRestaurado] = useState(false);
  const [enviandoIndice, setEnviandoIndice] = useState<number | null>(null);
  const [precioMesaActivo, setPrecioMesaActivo] = useState(true);
  const borrador = borradores[ventaActiva];
  const { carrito, pagos, clienteId, descuentoPct, descuentoResponsable, propina, error } = borrador;
  const enviando = enviandoIndice === ventaActiva;

  function actualizarBorrador(indice: number, cambios: Partial<BorradorVenta>) {
    setBorradores((actuales) =>
      actuales.map((item, posicion) => posicion === indice ? { ...item, ...cambios } : item)
    );
  }

  function actualizarActivo(cambios: Partial<BorradorVenta>) {
    actualizarBorrador(ventaActiva, cambios);
  }

  function setCarrito(valor: ItemCarrito[] | ((actual: ItemCarrito[]) => ItemCarrito[])) {
    setBorradores((actuales) => actuales.map((item, indice) => {
      if (indice !== ventaActiva) return item;
      return { ...item, carrito: typeof valor === "function" ? valor(item.carrito) : valor };
    }));
  }

  const setPagos = (valor: PagoLinea[]) => actualizarActivo({ pagos: valor });
  const setClienteId = (valor: string) => actualizarActivo({ clienteId: valor });
  const setDescuentoPct = (valor: string) => actualizarActivo({ descuentoPct: valor });
  const setDescuentoResponsable = (valor: string) => actualizarActivo({ descuentoResponsable: valor });
  const setPropina = (valor: string) => actualizarActivo({ propina: valor });
  const setError = (valor: string) => actualizarActivo({ error: valor });

  useEffect(() => {
    // Cargar clientes y configuración (productos se cargan del caché en BuscadorProducto)
    Promise.all([
      fetch("/api/clientes").then((res) => res.json()),
      fetch("/api/configuracion").then((res) => res.json()),
    ]).then(([clientes, configuracion]) => {
      setClientes(Array.isArray(clientes) ? clientes : []);
      setPrecioMesaActivo(configuracion?.precioMesaActivo !== false);
    }).catch((err) => {
      console.error("Error cargando datos iniciales:", err);
      setClientes([]);
    });
  }, []);

  // Restaura las tres ventas sin cobrar. También migra el carrito único de versiones anteriores.
  useEffect(() => {
    try {
      const guardados = localStorage.getItem(CLAVE_BORRADORES);
      if (guardados) {
        const datos = JSON.parse(guardados);
        // La restauración desde almacenamiento externo se realiza una sola vez al montar.
        // eslint-disable-next-line react-hooks/set-state-in-effect
        if (Array.isArray(datos) && datos.length === 3) setBorradores(datos);
      } else {
        const carritoAnterior = localStorage.getItem("carrito-venta");
        if (carritoAnterior) {
          const migrados = Array.from({ length: 3 }, borradorVacio);
          migrados[0].carrito = JSON.parse(carritoAnterior);
          setBorradores(migrados);
          localStorage.removeItem("carrito-venta");
        }
      }
    } catch {
      localStorage.removeItem(CLAVE_BORRADORES);
    }
    setRestaurado(true);
  }, []);

  // Guarda productos y datos de cobro de las tres ventas en este dispositivo.
  useEffect(() => {
    if (restaurado) localStorage.setItem(CLAVE_BORRADORES, JSON.stringify(borradores));
  }, [borradores, restaurado]);

  const subtotal = useMemo(() => carrito.reduce((acc, i) => acc + i.precioUnitario * i.cantidad, 0), [carrito]);
  const descuento = useMemo(() => aplicarDescuento(subtotal, Number(descuentoPct)), [subtotal, descuentoPct]);
  const total = descuento.total;

  function agregar(
    p: ProductoBusqueda,
    tarifa: Tarifa,
    precioUnitario: number,
    cantidad = 1
  ) {
    setCarrito((prev) => {
      const existe = prev.find((i) => i.productoId === p.id && i.tarifa === tarifa);
      if (existe) {
        return prev.map((i) => (i === existe ? { ...i, cantidad: i.cantidad + cantidad } : i));
      }
      return [
        ...prev,
        {
          productoId: p.id,
          nombre: p.nombre,
          tarifa,
          precioUnitario,
          cantidad,
          stockDisponible: p.stock ?? 0,
        },
      ];
    });
  }

  function cambiarCantidad(productoId: number, tarifa: Tarifa, cantidad: number) {
    setCarrito((prev) =>
      prev
        .map((i) => (i.productoId === productoId && i.tarifa === tarifa ? { ...i, cantidad: Math.max(0, cantidad) } : i))
        .filter((i) => i.cantidad > 0)
    );
  }

  function quitar(productoId: number, tarifa: Tarifa) {
    setCarrito((prev) => prev.filter((i) => !(i.productoId === productoId && i.tarifa === tarifa)));
  }

  async function confirmarVenta() {
    const indiceVenta = ventaActiva;
    setError("");
    if (carrito.length === 0) {
      setError("El carrito está vacío");
      return;
    }
    if (!pagosCuadran(pagos, total)) {
      setError("El total pagado no coincide con el total de la venta");
      return;
    }
    if (requiereCliente(pagos) && !clienteId) {
      setError("Elegí un cliente para la parte fiada");
      return;
    }
    if (descuento.pct > 0 && !descuentoResponsable.trim()) {
      setError("Escribí el nombre de quien aplica el descuento");
      return;
    }

    const pagosFinales = resolvePagos(pagos, total);
    setEnviandoIndice(indiceVenta);
    try {
      const res = await fetch("/api/ventas", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          items: carrito.map((i) => ({
            productoId: i.productoId,
            cantidad: i.cantidad,
            tarifa: i.tarifa,
            precioUnitario: i.precioUnitario,
          })),
          pagos: pagosFinales.map((p) => ({ metodo: p.metodo, monto: Number(p.monto), tipoTarjeta: p.metodo === "TARJETA" ? p.tipoTarjeta || "QR" : null })),
          clienteId: requiereCliente(pagos) ? Number(clienteId) : null,
          descuentoPct: Number(descuentoPct) || 0,
          descuentoResponsable: descuentoResponsable.trim() || null,
          propina: Number(propina) || 0,
        }),
      });

      if (!res.ok) {
        const data = await res.json();
        actualizarBorrador(indiceVenta, { error: data.error || "Ocurrió un error" });
        return;
      }

      const venta = await res.json();
      const resImp = await fetch(`/api/ventas/${venta.id}/imprimir`, { method: "POST" }).catch(() => null);
      const limpio = borradorVacio();
      if (!resImp?.ok) limpio.error = "La venta se guardó, pero no se pudo enviar el ticket a la estación de impresión.";
      setBorradores((actuales) =>
        actuales.map((item, posicion) => posicion === indiceVenta ? limpio : item)
      );
    } catch {
      actualizarBorrador(indiceVenta, { error: "No se pudo conectar para guardar la venta" });
    } finally {
      setEnviandoIndice((actual) => actual === indiceVenta ? null : actual);
    }
  }

  return (
    <div className="max-w-7xl mx-auto grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
      <div className="flex flex-col gap-3">
        <h1 className="text-2xl font-semibold tracking-tight text-neutral-900 dark:text-neutral-50">Venta (mostrador)</h1>
        <div className="grid grid-cols-3 gap-2">
          {borradores.map((venta, indice) => {
            const importe = venta.carrito.reduce((suma, item) => suma + item.precioUnitario * item.cantidad, 0);
            const activa = indice === ventaActiva;
            return (
              <button
                key={indice}
                type="button"
                onClick={() => setVentaActiva(indice)}
                className={`rounded-lg border px-2 py-2 text-left transition-colors ${
                  activa
                    ? "border-blue-600 bg-blue-600 text-white"
                    : "border-neutral-300 bg-white text-neutral-700 hover:border-blue-400 dark:border-neutral-700 dark:bg-neutral-900 dark:text-neutral-200"
                }`}
              >
                <div className="flex items-center justify-between gap-1 text-xs font-semibold">
                  <span>Venta {indice + 1}</span>
                  {enviandoIndice === indice && <span className="animate-pulse">Cobrando...</span>}
                </div>
                <div className={`mt-0.5 truncate text-[11px] ${activa ? "text-blue-100" : "text-neutral-500"}`}>
                  {venta.carrito.length
                    ? `${venta.carrito.length} producto${venta.carrito.length === 1 ? "" : "s"} · $${formatearMoneda(importe)}`
                    : "Disponible"}
                </div>
              </button>
            );
          })}
        </div>
        <BuscadorProducto
          onSeleccionar={agregar}
          precioMesaActivo={precioMesaActivo}
          soloPrecioVenta
          permitirPrecioLibre
        />

        {carrito.length > 0 && (
          <div className="text-xs text-blue-500 bg-blue-600/10 border border-blue-600/30 rounded-lg px-3 py-2">
            Este carrito todavía no se cobró. No se guarda hasta tocar &quot;Cobrar&quot;.
          </div>
        )}

        <Card>
          {carrito.length === 0 ? (
            <div className="p-4 text-sm text-neutral-500">Escaneá o buscá un producto para agregarlo</div>
          ) : (
            <table className="w-full">
              <thead>
                <tr>
                  <th className={th}>Producto</th>
                  <th className={`${th} w-24`}>Cant.</th>
                  <th className={`${th} w-24`}>Subtotal</th>
                  <th className={th}></th>
                </tr>
              </thead>
              <tbody>
                {carrito.map((i) => (
                  <tr key={`${i.productoId}-${i.tarifa}`} className={trHover}>
                    <td className={td}>
                      {i.nombre}{" "}
                      {precioMesaActivo && (
                        <Badge variant={i.tarifa === "MESA" ? "accent" : "neutral"} className="ml-1">
                          {i.tarifa === "MESA" ? "Mesa" : "Mostrador"}
                        </Badge>
                      )}
                    </td>
                    <td className={`${td} text-center`}>
                      <div className="flex items-center justify-center gap-1">
                        <button
                          className="w-6 h-6 text-xs rounded border border-neutral-300 dark:border-neutral-700 hover:bg-neutral-100 dark:hover:bg-neutral-800"
                          onClick={() => cambiarCantidad(i.productoId, i.tarifa, Math.max(1, i.cantidad - 1))}
                        >
                          −
                        </button>
                        <input
                          type="number"
                          inputMode="numeric"
                          className="w-12 text-center rounded border border-neutral-300 dark:border-neutral-700 bg-white dark:bg-neutral-950 px-1 py-0.5 text-sm text-neutral-900 dark:text-neutral-100 focus:outline-none focus:ring-2 focus:ring-blue-600/50"
                          value={i.cantidad}
                          onChange={(e) => cambiarCantidad(i.productoId, i.tarifa, Number(e.target.value) || 1)}
                        />
                        <button
                          className="w-6 h-6 text-xs rounded border border-neutral-300 dark:border-neutral-700 hover:bg-neutral-100 dark:hover:bg-neutral-800"
                          onClick={() => cambiarCantidad(i.productoId, i.tarifa, i.cantidad + 1)}
                        >
                          +
                        </button>
                      </div>
                    </td>
                    <td className={td}>${formatearMoneda(i.precioUnitario * i.cantidad)}</td>
                    <td className={`${td} text-right`}>
                      <button
                        className="text-red-400 hover:text-red-300"
                        onClick={() => quitar(i.productoId, i.tarifa)}
                      >
                        Quitar
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </Card>

      </div>

      <div className="flex flex-col gap-3">
        <Card className="p-4 flex flex-col gap-3">
          <div className="flex justify-between items-baseline text-sm">
            <span className="text-neutral-500">Subtotal</span>
            <span className="text-neutral-700 dark:text-neutral-300">${formatearMoneda(subtotal)}</span>
          </div>
          <div className="flex items-center justify-between gap-2">
            <div className="flex flex-1 flex-wrap items-center gap-2">
              <label className="text-xs text-neutral-500 flex items-center gap-1.5">
                Descuento
                <input
                  type="number"
                  min="0"
                  max="100"
                  step="0.1"
                  value={descuentoPct}
                  onChange={(e) => setDescuentoPct(e.target.value)}
                  className="w-14 rounded border border-neutral-300 dark:border-neutral-700 bg-white dark:bg-neutral-950 px-1.5 py-0.5 text-xs text-neutral-700 dark:text-neutral-200 focus:outline-none focus:ring-2 focus:ring-blue-600/50"
                />
                %
              </label>
              {descuentoPct.trim() !== "" && (
                <input
                  type="text"
                  maxLength={80}
                  value={descuentoResponsable}
                  onChange={(e) => setDescuentoResponsable(e.target.value)}
                  placeholder="Nombre de quien aplica"
                  className="min-w-44 flex-1 rounded border border-neutral-300 bg-white px-2 py-1 text-xs text-neutral-700 focus:outline-none focus:ring-2 focus:ring-blue-600/50 dark:border-neutral-700 dark:bg-neutral-950 dark:text-neutral-200"
                />
              )}
            </div>
            {descuento.monto > 0 && (
              <span className="text-xs font-medium text-red-400">-${formatearMoneda(descuento.monto)}</span>
            )}
          </div>
          <div className="flex justify-between items-baseline pt-1 border-t border-neutral-200 dark:border-neutral-800">
            <span className="text-neutral-500 dark:text-neutral-400">Total final</span>
            <span className="text-2xl font-semibold text-neutral-900 dark:text-neutral-50">${formatearMoneda(total + (Number(propina) || 0))}</span>
          </div>

          <PagoSelector
            total={total}
            pagos={pagos}
            setPagos={setPagos}
            clientes={clientes}
            clienteId={clienteId}
            setClienteId={setClienteId}
            propina={propina}
            setPropina={setPropina}
          />

          <Button
            variant="primary"
            size="md"
            className="w-full py-2.5"
            disabled={carrito.length === 0 || enviando}
            onClick={confirmarVenta}
          >
            {enviando ? "Procesando..." : "Cobrar e imprimir ticket"}
          </Button>
          {error && <span className="text-sm text-red-400">{error}</span>}
        </Card>
      </div>
    </div>
  );
}
