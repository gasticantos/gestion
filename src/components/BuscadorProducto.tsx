"use client";

import { useMemo, useRef, useState, KeyboardEvent, memo } from "react";
import { input } from "@/components/ui/styles";
import { calcularPrecio, Tarifa } from "@/lib/precio";
import { formatearMoneda } from "@/lib/formato";
import VirtualKeyboard from "@/components/VirtualKeyboard";

export type ProductoBusqueda = {
  id: number;
  nombre: string;
  codigoBarras: string | null;
  unidad?: string;
  stock?: number;
  precioVenta: number;
};

function BuscadorProductoBase({
  productos,
  onSeleccionar,
  recargoMesaPct = 0,
  elegirPrecio: pedirPrecio = true,
  placeholder,
}: {
  productos: ProductoBusqueda[];
  onSeleccionar: (p: ProductoBusqueda, tarifa: Tarifa, precioUnitario: number) => void;
  recargoMesaPct?: number;
  /** Si es false, agrega directo al precio de mostrador sin mostrar el paso de elegir precio (uso en carga de stock). */
  elegirPrecio?: boolean;
  placeholder?: string;
}) {
  const [query, setQuery] = useState("");
  const [elegido, setElegido] = useState<ProductoBusqueda | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const resultados = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return [];

    // Buscar por código de barras exacto
    if (productos.some((p) => p.codigoBarras?.toLowerCase() === q)) {
      return productos.filter((p) => p.codigoBarras?.toLowerCase() === q);
    }

    // Dividir por espacios para múltiples términos
    const terminos = q.split(/\s+/).filter(Boolean);

    return productos
      .filter((p) => {
        const nombreLower = p.nombre.toLowerCase();
        const codigoLower = p.codigoBarras?.toLowerCase() || "";

        // Todas las palabras deben estar en el nombre o código
        return terminos.every((termino) =>
          nombreLower.includes(termino) || codigoLower.includes(termino)
        );
      })
      .slice(0, 12);
  }, [query, productos]);

  function elegirProducto(p: ProductoBusqueda) {
    if (!pedirPrecio) {
      onSeleccionar(p, "PARTICULAR", p.precioVenta);
      setQuery("");
      inputRef.current?.focus();
      return;
    }
    setElegido(p);
    setQuery("");
  }

  function elegirPrecio(tarifa: Tarifa) {
    if (!elegido) return;
    onSeleccionar(elegido, tarifa, calcularPrecio(elegido.precioVenta, tarifa, recargoMesaPct));
    setElegido(null);
    inputRef.current?.focus();
  }

  function cancelarEleccion() {
    setElegido(null);
    inputRef.current?.focus();
  }

  const handleVirtualKeyboardInput = (char: string) => {
    if (char === "\b") {
      // Backspace
      setQuery((q) => q.slice(0, -1));
    } else if (char === "\n") {
      // Enter
      const q = query.trim();
      if (!q) return;
      const exacto = productos.find((p) => p.codigoBarras === q);
      if (exacto) {
        elegirProducto(exacto);
        return;
      }
      if (resultados.length === 1) {
        elegirProducto(resultados[0]);
      }
    } else {
      setQuery((q) => q + char);
    }
  };

  function handleKeyDown(e: KeyboardEvent<HTMLInputElement>) {
    if (e.key !== "Enter") return;
    e.preventDefault();
    const q = query.trim();
    if (!q) return;

    // Lector de código de barras: tipea el código exacto seguido de Enter.
    const exacto = productos.find((p) => p.codigoBarras === q);
    if (exacto) {
      elegirProducto(exacto);
      return;
    }
    // Si la búsqueda por texto deja un único resultado, lo seleccionamos directamente.
    if (resultados.length === 1) {
      elegirProducto(resultados[0]);
    }
  }

  if (elegido) {
    const precioMostrador = calcularPrecio(elegido.precioVenta, "PARTICULAR", recargoMesaPct);
    const precioMesa = calcularPrecio(elegido.precioVenta, "MESA", recargoMesaPct);
    return (
      <div className="flex flex-col gap-2">
        <div className="text-sm text-neutral-300">
          <span className="font-medium">{elegido.nombre}</span> · elegí el precio
        </div>
        <div className="grid grid-cols-2 gap-2">
          <button
            type="button"
            onClick={() => elegirPrecio("PARTICULAR")}
            className="rounded-lg border-2 border-neutral-700 hover:border-blue-600/70 bg-neutral-900 px-3 py-3 flex flex-col items-center gap-1 transition-colors"
          >
            <span className="text-xs font-medium text-neutral-400">Precio mostrador</span>
            <span className="text-lg font-bold text-neutral-50">${formatearMoneda(precioMostrador)}</span>
          </button>
          <button
            type="button"
            onClick={() => elegirPrecio("MESA")}
            className="rounded-lg border-2 border-neutral-700 hover:border-blue-600/70 bg-neutral-900 px-3 py-3 flex flex-col items-center gap-1 transition-colors"
          >
            <span className="text-xs font-medium text-neutral-400">Precio mesa</span>
            <span className="text-lg font-bold text-neutral-50">${formatearMoneda(precioMesa)}</span>
          </button>
        </div>
        <button type="button" onClick={cancelarEleccion} className="text-xs text-neutral-500 hover:text-neutral-300 self-start">
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
        inputMode="none"
        autoFocus
        autoComplete="off"
        autoCorrect="off"
        autoCapitalize="off"
        spellCheck={false}
        data-lpignore="true"
        data-1p-ignore
        data-form-type="other"
        className={`${input} py-3 text-lg sm:text-base`}
        placeholder={placeholder || "Escanear código de barras o escribir para buscar..."}
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        onKeyDown={handleKeyDown}
      />
      {resultados.length > 0 && (
        <div className="flex flex-col gap-1.5 max-h-64 overflow-y-auto">
          {resultados.map((p) => (
            <button
              key={p.id}
              type="button"
              onClick={() => elegirProducto(p)}
              className="rounded-lg border border-neutral-700 bg-neutral-900 hover:border-blue-600/60 hover:bg-neutral-800 px-3 py-2 text-left transition-colors"
            >
              <div className="text-sm font-medium text-neutral-100 line-clamp-2">{p.nombre}</div>
              {p.codigoBarras && <div className="text-xs text-neutral-500 mt-0.5">{p.codigoBarras}</div>}
            </button>
          ))}
        </div>
      )}
      <VirtualKeyboard onInput={handleVirtualKeyboardInput} />
    </div>
  );
}

export default memo(BuscadorProductoBase);
