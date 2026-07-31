"use client";

import { useEffect, useMemo, useRef, useState, KeyboardEvent, memo } from "react";
import { input } from "@/components/ui/styles";
import { Tarifa } from "@/lib/precio";
import { formatearMoneda } from "@/lib/formato";
import VirtualKeyboard from "@/components/VirtualKeyboard";
import { useData } from "@/hooks/useData";

export type ProductoBusqueda = {
  id: number;
  nombre: string;
  codigoBarras: string | null;
  unidad?: string;
  stock?: number;
  precioVenta: number;
  precioVentaMesa?: number;
};

function BuscadorProductoBase({
  productos: productosProp,
  onSeleccionar,
  elegirPrecio: pedirPrecio = true,
  precioMesaActivo = true,
  permitirNotas = false,
  placeholder,
}: {
  productos?: ProductoBusqueda[];
  onSeleccionar: (
    p: ProductoBusqueda,
    tarifa: Tarifa,
    precioUnitario: number,
    cantidad?: number,
    notas?: string
  ) => void;
  /** Si es false, agrega directo al precio de mostrador sin mostrar el paso de elegir precio (uso en carga de stock). */
  elegirPrecio?: boolean;
  precioMesaActivo?: boolean;
  permitirNotas?: boolean;
  placeholder?: string;
}) {
  // Usar caché de productos si no se pasan como prop
  const { data: productosCache } = useData<ProductoBusqueda>("productos");
  const productos = productosProp || productosCache || [];
  const [query, setQuery] = useState("");
  const [elegido, setElegido] = useState<ProductoBusqueda | null>(null);
  const [cantidad, setCantidad] = useState(1);
  const [notas, setNotas] = useState("");
  const [dispositivoTactil, setDispositivoTactil] = useState(false);
  const [mostrarTeclado, setMostrarTeclado] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setDispositivoTactil(
      navigator.maxTouchPoints > 0 || window.matchMedia("(pointer: coarse)").matches
    );
  }, []);

  const indiceBusqueda = useMemo(
    () =>
      productos.map((producto) => ({
        producto,
        nombre: producto.nombre.toLocaleLowerCase("es"),
        codigo: producto.codigoBarras?.toLocaleLowerCase("es") || "",
      })),
    [productos]
  );

  const resultados = useMemo(() => {
    const q = query.trim().toLocaleLowerCase("es");
    if (!q) return [];

    const exacto = indiceBusqueda.find((item) => item.codigo === q);
    if (exacto) return [exacto.producto];

    const terminos = q.split(/\s+/).filter(Boolean);
    const encontrados: ProductoBusqueda[] = [];
    for (const item of indiceBusqueda) {
      if (terminos.every((termino) => item.nombre.includes(termino) || item.codigo.includes(termino))) {
        encontrados.push(item.producto);
        if (encontrados.length === 12) break;
      }
    }
    return encontrados;
  }, [query, indiceBusqueda]);

  function elegirProducto(p: ProductoBusqueda) {
    setMostrarTeclado(false);
    if (!pedirPrecio) {
      onSeleccionar(p, "PARTICULAR", p.precioVenta);
      setQuery("");
      inputRef.current?.focus();
      return;
    }
    setCantidad(1);
    setNotas("");
    setElegido(p);
    setQuery("");
  }

  function elegirPrecio(tarifa: Tarifa) {
    if (!elegido) return;
    const precio = tarifa === "MESA" ? elegido.precioVentaMesa ?? elegido.precioVenta : elegido.precioVenta;
    onSeleccionar(elegido, tarifa, precio, cantidad, permitirNotas ? notas.trim() : "");
    setElegido(null);
    setCantidad(1);
    setNotas("");
    inputRef.current?.focus();
  }

  function cancelarEleccion() {
    setElegido(null);
    inputRef.current?.focus();
  }

  function handleKeyDown(e: KeyboardEvent<HTMLInputElement>) {
    if (e.key !== "Enter") return;
    e.preventDefault();
    const q = query.trim().toLocaleLowerCase("es");
    if (!q) return;

    // Lector de código de barras: tipea el código exacto seguido de Enter.
    const exacto = productos.find((p) => p.codigoBarras?.toLocaleLowerCase("es") === q);
    if (exacto) {
      elegirProducto(exacto);
      return;
    }
    // Si la búsqueda por texto deja un único resultado, lo seleccionamos directamente.
    if (resultados.length === 1) {
      elegirProducto(resultados[0]);
    }
  }

  function entradaVirtual(char: string) {
    if (char === "\n") {
      const q = query.trim().toLocaleLowerCase("es");
      if (!q) return;
      const exacto = productos.find((p) => p.codigoBarras?.toLocaleLowerCase("es") === q);
      if (exacto) elegirProducto(exacto);
      else if (resultados.length === 1) elegirProducto(resultados[0]);
      return;
    }
    setQuery((actual) => (char === "\b" ? actual.slice(0, -1) : actual + char));
  }

  if (elegido) {
    const precioMostrador = elegido.precioVenta;
    const precioMesa = elegido.precioVentaMesa ?? elegido.precioVenta;
    return (
      <div className="flex flex-col gap-2">
        <div className="text-sm text-neutral-700 dark:text-neutral-300">
          <span className="font-medium">{elegido.nombre}</span> · elegí el precio
        </div>
        <div className="flex items-center justify-between gap-3 rounded-lg border border-neutral-300 dark:border-neutral-700 p-2">
          <span className="text-sm text-neutral-600 dark:text-neutral-300">Cantidad</span>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setCantidad((actual) => Math.max(1, actual - 1))}
              className="w-9 h-9 rounded-lg border border-neutral-300 dark:border-neutral-700 text-lg"
            >
              −
            </button>
            <input
              type="number"
              min="1"
              step="1"
              inputMode="numeric"
              className={`${input} w-16 text-center`}
              value={cantidad}
              onChange={(e) => setCantidad(Math.max(1, Math.floor(Number(e.target.value) || 1)))}
            />
            <button
              type="button"
              onClick={() => setCantidad((actual) => actual + 1)}
              className="w-9 h-9 rounded-lg border border-neutral-300 dark:border-neutral-700 text-lg"
            >
              +
            </button>
          </div>
        </div>
        {permitirNotas && (
          <div>
            <label className="text-xs text-neutral-500">Notas para la comanda</label>
            <textarea
              className={`${input} mt-1 min-h-16 resize-none`}
              maxLength={200}
              placeholder="Ej.: sin azúcar, bien caliente..."
              value={notas}
              onChange={(e) => setNotas(e.target.value)}
            />
          </div>
        )}
        <div className="grid grid-cols-1 gap-2">
          <button
            type="button"
            onClick={() => elegirPrecio("PARTICULAR")}
            className="rounded-lg border-2 border-neutral-300 dark:border-neutral-700 hover:border-blue-600/70 bg-white dark:bg-neutral-900 px-3 py-3 flex flex-col items-center gap-1 transition-colors"
          >
            <span className="text-xs font-medium text-neutral-500 dark:text-neutral-400">Precio venta</span>
            <span className="text-lg font-bold text-neutral-900 dark:text-neutral-50">${formatearMoneda(precioMostrador)}</span>
          </button>
        </div>
        <button type="button" onClick={cancelarEleccion} className="text-xs text-neutral-500 hover:text-neutral-700 dark:hover:text-neutral-300 self-start">
          ‹ Volver a buscar
        </button>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-2">
      <input
        ref={inputRef}
        type="text"
        autoFocus
        autoComplete="off"
        autoCorrect="off"
        autoCapitalize="off"
        spellCheck={false}
        inputMode={dispositivoTactil ? "none" : "text"}
        readOnly={dispositivoTactil}
        data-lpignore="true"
        data-1p-ignore
        data-form-type="other"
        className={`${input} py-2.5`}
        placeholder={placeholder || "Escanear código de barras o escribir para buscar..."}
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        onFocus={() => dispositivoTactil && setMostrarTeclado(true)}
        onPointerDown={() => dispositivoTactil && setMostrarTeclado(true)}
        onKeyDown={handleKeyDown}
      />
      {dispositivoTactil && mostrarTeclado && (
        <VirtualKeyboard onInput={entradaVirtual} onCerrar={() => setMostrarTeclado(false)} />
      )}
      {resultados.length > 0 && (
        <div className="flex flex-col gap-1.5 max-h-64 overflow-y-auto">
          {resultados.map((p) => (
            <button
              key={p.id}
              type="button"
              onClick={() => elegirProducto(p)}
              className="rounded-lg border border-neutral-300 dark:border-neutral-700 bg-white dark:bg-neutral-900 hover:border-blue-600/60 hover:bg-neutral-100 dark:hover:bg-neutral-800 px-3 py-2 text-left transition-colors"
            >
              <div className="text-sm font-medium text-neutral-800 dark:text-neutral-100 line-clamp-2">{p.nombre}</div>
              {p.codigoBarras && <div className="text-xs text-neutral-500 mt-0.5">{p.codigoBarras}</div>}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

export default memo(BuscadorProductoBase);
