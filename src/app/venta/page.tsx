"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
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
import { imprimirEnSegundoPlano } from "@/lib/imprimir";

type Producto = ProductoBusqueda & { stock: number };

type ItemCarrito = {
  productoId: number;
  nombre: string;
  tarifa: Tarifa;
  precioUnitario: number;
  cantidad: number;
  stockDisponible: number;
};

export default function VentaPage() {
  const router = useRouter();
  const [productos, setProductos] = useState<Producto[]>([]);
  const [clientes, setClientes] = useState<ClienteOpcion[]>([]);
  const [carrito, setCarrito] = useState<ItemCarrito[]>([]);
  const [pagos, setPagos] = useState<PagoLinea[]>([{ metodo: "EFECTIVO", monto: "0" }]);
  const [clienteId, setClienteId] = useState("");
  const [descuentoPct, setDescuentoPct] = useState("0");
  const [error, setError] = useState("");
  const [enviando, setEnviando] = useState(false);
  const [recargoMesaPct, setRecargoMesaPct] = useState(0);

  useEffect(() => {
    // Carga productos primero (crítico para búsqueda)
    Promise.all([
      fetch("/api/productos").then((res) => res.json()),
      fetch("/api/clientes").then((res) => res.json()),
      fetch("/api/configuracion").then((res) => res.json()),
    ]).then(([productos, clientes, config]) => {
      setProductos(productos.filter((p: { activo: boolean }) => p.activo));
      setClientes(clientes);
      setRecargoMesaPct(config.recargoMesaPct);
    });
  }, []);

  // Restaura un carrito sin cobrar si volviste a esta pantalla sin haber tocado "Cobrar".
  useEffect(() => {
    const guardado = localStorage.getItem("carrito-venta");
    if (guardado) {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- restaura el borrador guardado localmente
      setCarrito(JSON.parse(guardado));
    }
  }, []);

  // Guarda el carrito en curso en el navegador para no perderlo si se navega a otra pantalla antes de cobrar.
  useEffect(() => {
    if (carrito.length > 0) {
      localStorage.setItem("carrito-venta", JSON.stringify(carrito));
    } else {
      localStorage.removeItem("carrito-venta");
    }
  }, [carrito]);

  const subtotal = useMemo(() => carrito.reduce((acc, i) => acc + i.precioUnitario * i.cantidad, 0), [carrito]);
  const descuento = useMemo(() => aplicarDescuento(subtotal, Number(descuentoPct)), [subtotal, descuentoPct]);
  const total = descuento.total;

  function agregar(p: ProductoBusqueda, tarifa: Tarifa, precioUnitario: number) {
    const producto = productos.find((x) => x.id === p.id);
    if (!producto) return;
    setCarrito((prev) => {
      const existe = prev.find((i) => i.productoId === p.id && i.tarifa === tarifa);
      if (existe) {
        return prev.map((i) => (i === existe ? { ...i, cantidad: i.cantidad + 1 } : i));
      }
      return [
        ...prev,
        {
          productoId: producto.id,
          nombre: producto.nombre,
          tarifa,
          precioUnitario,
          cantidad: 1,
          stockDisponible: producto.stock,
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

    const pagosFinales = resolvePagos(pagos, total);
    setEnviando(true);
    const res = await fetch("/api/ventas", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        items: carrito.map((i) => ({ productoId: i.productoId, cantidad: i.cantidad, tarifa: i.tarifa })),
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

    const venta = await res.json();

    // Imprimir el ticket real vía el diálogo de impresión del navegador (corre en la máquina
    // de la caja, no en el servidor, así que funciona sin importar dónde esté hosteada la app).
    // Se carga en un iframe oculto para no abrir pestaña ni navegar afuera de esta pantalla.
    imprimirEnSegundoPlano(`/ventas/${venta.id}/ticket`);

    setCarrito([]);
    setPagos([{ metodo: "EFECTIVO", monto: "0" }]);
    setClienteId("");
    setDescuentoPct("0");
  }

  return (
    <div className="max-w-7xl mx-auto grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
      <div className="flex flex-col gap-3">
        <h1 className="text-2xl font-semibold tracking-tight text-neutral-900 dark:text-neutral-50">Venta (mostrador)</h1>
        <BuscadorProducto productos={productos} onSeleccionar={agregar} recargoMesaPct={recargoMesaPct} />

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
                      <Badge variant={i.tarifa === "MESA" ? "accent" : "neutral"} className="ml-1">
                        {i.tarifa === "MESA" ? "Mesa" : "Mostrador"}
                      </Badge>
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
            {descuento.monto > 0 && (
              <span className="text-xs font-medium text-red-400">-${formatearMoneda(descuento.monto)}</span>
            )}
          </div>
          <div className="flex justify-between items-baseline pt-1 border-t border-neutral-200 dark:border-neutral-800">
            <span className="text-neutral-500 dark:text-neutral-400">Total</span>
            <span className="text-2xl font-semibold text-neutral-900 dark:text-neutral-50">${formatearMoneda(total)}</span>
          </div>

          <PagoSelector
            total={total}
            pagos={pagos}
            setPagos={setPagos}
            clientes={clientes}
            clienteId={clienteId}
            setClienteId={setClienteId}
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
