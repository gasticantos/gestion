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
  soloPrecioVenta = false,
  permitirPrecioLibre = false,
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
  /** Si es true, nunca ofrece el precio de mesa aunque precioMesaActivo esté activo (uso en venta de mostrador). */
  soloPrecioVenta?: boolean;
  /** Si es true, además de los presets de precio, permite escribir un precio a mano antes de agregar. */
  permitirPrecioLibre?: boolean;
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
  const [precioLibre, setPrecioLibre] = useState("");
  const [tarifaLibre, setTarifaLibre] = useState<Tarifa>("PARTICULAR");
  const [dispositivoTactil, setDispositivoTactil] = useState(false);
  const [mostrarTeclado, setMostrarTeclado] = useState(false);
  const [resaltado, setResaltado] = useState(0);
  const [queryResaltada, setQueryResaltada] = useState(query);
  const inputRef = useRef<HTMLInputElement>(null);
  const cantidadRef = useRef<HTMLInputElement>(null);
  const precioVentaBtnRef = useRef<HTMLButtonElement>(null);
  const precioMesaBtnRef = useRef<HTMLButtonElement>(null);
  const precioLibreInputRef = useRef<HTMLInputElement>(null);
  const agregarBtnRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    setDispositivoTactil(
      navigator.maxTouchPoints > 0 || window.matchMedia("(pointer: coarse)").matches
    );
  }, []);

  // Al entrar al paso de cantidad/precio, foco en cantidad para poder navegar con flechas.
  useEffect(() => {
    if (elegido) cantidadRef.current?.focus();
  }, [elegido]);

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

  // Al cambiar la búsqueda, volver a resaltar el primer resultado (ajustado durante
  // el render, sin useEffect, siguiendo el patrón recomendado por React).
  if (query !== queryResaltada) {
    setQueryResaltada(query);
    setResaltado(0);
  }

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
    setPrecioLibre(String(p.precioVenta));
    setTarifaLibre("PARTICULAR");
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

  function confirmarPrecioLibre() {
    if (!elegido) return;
    const precio = Math.max(0, Number(precioLibre) || 0);
    onSeleccionar(elegido, tarifaLibre, precio, cantidad, permitirNotas ? notas.trim() : "");
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
    if (e.key === "ArrowDown") {
      if (resultados.length === 0) return;
      e.preventDefault();
      setResaltado((i) => Math.min(resultados.length - 1, i + 1));
      return;
    }
    if (e.key === "ArrowUp") {
      if (resultados.length === 0) return;
      e.preventDefault();
      setResaltado((i) => Math.max(0, i - 1));
      return;
    }
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
    // Elegir el resultado resaltado (por defecto el primero, o el que se haya
    // recorrido con las flechas).
    if (resultados.length > 0) {
      elegirProducto(resultados[Math.min(resaltado, resultados.length - 1)]);
    }
  }

  function entradaVirtual(char: string) {
    if (char === "\n") {
      const q = query.trim().toLocaleLowerCase("es");
      if (!q) return;
      const exacto = productos.find((p) => p.codigoBarras?.toLocaleLowerCase("es") === q);
      if (exacto) elegirProducto(exacto);
      else if (resultados.length > 0) elegirProducto(resultados[Math.min(resaltado, resultados.length - 1)]);
      return;
    }
    setQuery((actual) => (char === "\b" ? actual.slice(0, -1) : actual + char));
  }

  // Navegación con flechas entre los controles del paso "elegí el precio"
  // (cantidad, presets de precio y, si aplica, el precio libre).
  function focoOrdenadoPrecio(): HTMLElement[] {
    const lista: (HTMLElement | null)[] = [cantidadRef.current, precioVentaBtnRef.current];
    if (precioMesaActivo && !soloPrecioVenta) lista.push(precioMesaBtnRef.current);
    if (permitirPrecioLibre) lista.push(precioLibreInputRef.current, agregarBtnRef.current);
    return lista.filter((el): el is HTMLElement => el !== null);
  }

  function manejarFlechasPrecio(e: KeyboardEvent) {
    if (!["ArrowDown", "ArrowUp", "ArrowLeft", "ArrowRight"].includes(e.key)) return;
    e.preventDefault();
    const orden = focoOrdenadoPrecio();
    const actual = orden.indexOf(document.activeElement as HTMLElement);
    if (actual === -1) return;
    const avanzar = e.key === "ArrowDown" || e.key === "ArrowRight";
    const siguiente = avanzar ? Math.min(orden.length - 1, actual + 1) : Math.max(0, actual - 1);
    orden[siguiente]?.focus();
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
              ref={cantidadRef}
              type="number"
              min="1"
              step="1"
              inputMode="numeric"
              className={`${input} w-16 text-center`}
              value={cantidad}
              onChange={(e) => setCantidad(Math.max(1, Math.floor(Number(e.target.value) || 1)))}
              onKeyDown={manejarFlechasPrecio}
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
        <div className={`grid ${precioMesaActivo && !soloPrecioVenta ? "grid-cols-2" : "grid-cols-1"} gap-2`}>
          <button
            ref={precioVentaBtnRef}
            type="button"
            onKeyDown={manejarFlechasPrecio}
            onClick={() => elegirPrecio("PARTICULAR")}
            className="rounded-lg border-2 border-neutral-300 dark:border-neutral-700 hover:border-blue-600/70 bg-white dark:bg-neutral-900 px-3 py-3 flex flex-col items-center gap-1 transition-colors"
          >
            <span className="text-xs font-medium text-neutral-500 dark:text-neutral-400">Precio venta</span>
            <span className="text-lg font-bold text-neutral-900 dark:text-neutral-50">${formatearMoneda(precioMostrador)}</span>
          </button>
          {precioMesaActivo && !soloPrecioVenta && (
            <button
              ref={precioMesaBtnRef}
              type="button"
              onKeyDown={manejarFlechasPrecio}
              onClick={() => elegirPrecio("MESA")}
              className="rounded-lg border-2 border-neutral-300 dark:border-neutral-700 hover:border-blue-600/70 bg-white dark:bg-neutral-900 px-3 py-3 flex flex-col items-center gap-1 transition-colors"
            >
              <span className="text-xs font-medium text-neutral-500 dark:text-neutral-400">Precio mesa</span>
              <span className="text-lg font-bold text-neutral-900 dark:text-neutral-50">${formatearMoneda(precioMesa)}</span>
            </button>
          )}
        </div>
        {permitirPrecioLibre && (
          <div className="flex items-center gap-2 rounded-lg border border-dashed border-neutral-300 dark:border-neutral-700 p-2">
            <span className="text-sm text-neutral-600 dark:text-neutral-300 whitespace-nowrap">Otro precio</span>
            <input
              ref={precioLibreInputRef}
              type="number"
              min="0"
              step="0.01"
              inputMode="decimal"
              className={`${input} flex-1`}
              value={precioLibre}
              onChange={(e) => setPrecioLibre(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  confirmarPrecioLibre();
                  return;
                }
                manejarFlechasPrecio(e);
              }}
            />
            <button
              ref={agregarBtnRef}
              type="button"
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  confirmarPrecioLibre();
                  return;
                }
                manejarFlechasPrecio(e);
              }}
              onClick={confirmarPrecioLibre}
              className="rounded-lg bg-blue-600 text-white hover:bg-blue-700 px-3 py-2 text-sm font-semibold transition-colors whitespace-nowrap"
            >
              Agregar
            </button>
          </div>
        )}
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
          {resultados.map((p, idx) => (
            <button
              key={p.id}
              type="button"
              onClick={() => elegirProducto(p)}
              onMouseEnter={() => setResaltado(idx)}
              className={`rounded-lg border px-3 py-2 text-left transition-colors ${
                idx === resaltado
                  ? "border-blue-600 bg-neutral-100 dark:bg-neutral-800"
                  : "border-neutral-300 dark:border-neutral-700 bg-white dark:bg-neutral-900 hover:border-blue-600/60 hover:bg-neutral-100 dark:hover:bg-neutral-800"
              }`}
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
