"use client";

import { useEffect, useMemo, useState, FormEvent } from "react";
import dynamic from "next/dynamic";
import Card from "@/components/ui/Card";
import Button from "@/components/ui/Button";
import Badge from "@/components/ui/Badge";
import Plegable from "@/components/ui/Plegable";
import { input, label, th, td, trHover } from "@/components/ui/styles";
import { formatearMoneda } from "@/lib/formato";

const ImportarProductos = dynamic(() => import("@/components/ImportarProductos"), {
  loading: () => <div className="h-48 bg-neutral-200 dark:bg-neutral-800 rounded-lg animate-pulse" />
});

type Categoria = { id: number; nombre: string; activo: boolean };

type Proveedor = {
  id: number;
  nombre: string;
};

type Producto = {
  id: number;
  nombre: string;
  codigoBarras: string | null;
  codigoInterno: string | null;
  marca: string | null;
  categoriaId: number | null;
  categoria: Categoria | null;
  precioVenta: number;
  precioVentaMesa: number;
  precioVentaMesaManual: boolean;
  precioCosto: number;
  stock: number;
  unidad: string;
  activo: boolean;
  proveedorId: number | null;
  proveedor: Proveedor | null;
  updatedAt: string;
};

const emptyForm = {
  nombre: "",
  codigoBarras: "",
  categoriaId: "",
  precioVenta: "",
  precioVentaMesa: "",
  precioCosto: "",
  stock: "",
  unidad: "unidad",
  proveedorId: "",
};

type EditForm = typeof emptyForm & { precioVentaMesaManual: boolean };

const MARGEN_SUGERIDO_PCT = 30;

function calcularVentaSugerida(costo: string) {
  const num = Number(costo);
  return num > 0 ? (num * (1 + MARGEN_SUGERIDO_PCT / 100)).toFixed(2) : "";
}

// El precio de mesa sugerido = precio de venta normal + el % de recargo de mesa (Configuración)
// calculado sobre el costo. Ej: costo 100, venta 130 (+30%), recargo mesa 30% -> mesa 160 (+60% sobre costo).
function calcularVentaMesaSugerida(venta: string, costo: string, recargoMesaPct: number) {
  const ventaNum = Number(venta);
  const costoNum = Number(costo);
  if (!ventaNum) return "";
  return (ventaNum + costoNum * (recargoMesaPct / 100)).toFixed(2);
}

function margenPct(costo: number, venta: number): number | null {
  if (!costo || costo <= 0) return null;
  return ((venta - costo) / costo) * 100;
}

function MargenBadge({
  costo,
  venta,
  sugerido,
  small,
  compacto,
}: {
  costo: number;
  venta: number;
  sugerido?: boolean;
  small?: boolean;
  /** true: solo "(+30%)" para celdas de tabla. false: "(+30% margen sugerido)" para labels de formulario. */
  compacto?: boolean;
}) {
  const m = margenPct(costo, venta);
  if (m === null) return null;
  const color =
    m < 0
      ? "text-red-600/70 dark:text-red-400/70"
      : m < 15
        ? "text-amber-600/70 dark:text-amber-400/70"
        : "text-emerald-600/70 dark:text-emerald-400/70";
  return (
    <span className={`${small ? "text-xs" : ""} font-normal ${color}`}>
      ({m > 0 ? "+" : ""}
      {m.toFixed(0)}%{compacto ? "" : ` margen${sugerido ? " sugerido" : ""}`})
    </span>
  );
}

export default function ProductosPage() {
  const [productos, setProductos] = useState<Producto[]>([]);
  const [proveedores, setProveedores] = useState<Proveedor[]>([]);
  const [categorias, setCategorias] = useState<Categoria[]>([]);
  const [form, setForm] = useState(emptyForm);
  const [ventaManual, setVentaManual] = useState(false);
  const [ventaMesaManual, setVentaMesaManual] = useState(false);
  const [recargoMesaPct, setRecargoMesaPct] = useState(0);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [mostrarInactivos, setMostrarInactivos] = useState(false);
  const [busqueda, setBusqueda] = useState("");
  const [filtroCategoria, setFiltroCategoria] = useState("");
  const [editandoId, setEditandoId] = useState<number | null>(null);
  const [edit, setEdit] = useState<EditForm>({ ...emptyForm, precioVentaMesaManual: false });
  const [errorFila, setErrorFila] = useState("");

  async function cargar() {
    setLoading(true);
    const [prodRes, provRes, catRes, configRes] = await Promise.all([
      fetch("/api/productos"),
      fetch("/api/proveedores"),
      fetch("/api/categorias"),
      fetch("/api/configuracion"),
    ]);
    setProductos(await prodRes.json());
    setProveedores(await provRes.json());
    setCategorias(await catRes.json());
    setRecargoMesaPct((await configRes.json()).recargoMesaPct);
    setLoading(false);
  }

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- carga inicial de datos al montar la página
    cargar();
  }, []);

  async function agregar(e: FormEvent) {
    e.preventDefault();
    setError("");

    const res = await fetch("/api/productos", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        nombre: form.nombre,
        codigoBarras: form.codigoBarras || null,
        categoriaId: form.categoriaId || null,
        precioVenta: form.precioVenta,
        precioVentaMesa: form.precioVentaMesa,
        precioVentaMesaManual: ventaMesaManual,
        precioCosto: form.precioCosto,
        stock: form.stock,
        unidad: form.unidad,
        proveedorId: form.proveedorId || null,
      }),
    });

    if (!res.ok) {
      const data = await res.json();
      setError(data.error || "Ocurrió un error");
      return;
    }

    setForm(emptyForm);
    setVentaManual(false);
    setVentaMesaManual(false);
    await cargar();
  }

  function cambiarCostoNuevo(valor: string) {
    setForm((f) => {
      const precioVenta = ventaManual ? f.precioVenta : calcularVentaSugerida(valor);
      const precioVentaMesa = ventaMesaManual ? f.precioVentaMesa : calcularVentaMesaSugerida(precioVenta, valor, recargoMesaPct);
      return { ...f, precioCosto: valor, precioVenta, precioVentaMesa };
    });
  }

  function cambiarVentaNuevo(valor: string) {
    setVentaManual(true);
    setForm((f) => ({
      ...f,
      precioVenta: valor,
      precioVentaMesa: ventaMesaManual ? f.precioVentaMesa : calcularVentaMesaSugerida(valor, f.precioCosto, recargoMesaPct),
    }));
  }

  function cambiarVentaMesaNuevo(valor: string) {
    setVentaMesaManual(true);
    setForm((f) => ({ ...f, precioVentaMesa: valor }));
  }

  function iniciarEdicion(p: Producto) {
    setEditandoId(p.id);
    setErrorFila("");
    setEdit({
      nombre: p.nombre,
      codigoBarras: p.codigoBarras || "",
      categoriaId: p.categoriaId ? String(p.categoriaId) : "",
      precioVenta: String(p.precioVenta),
      precioVentaMesa: String(p.precioVentaMesa),
      precioVentaMesaManual: p.precioVentaMesaManual,
      precioCosto: String(p.precioCosto),
      stock: String(p.stock),
      unidad: p.unidad,
      proveedorId: p.proveedorId ? String(p.proveedorId) : "",
    });
  }

  function cambiarCostoEdit(valor: string) {
    setEdit((f) => ({
      ...f,
      precioCosto: valor,
      precioVentaMesa: f.precioVentaMesaManual ? f.precioVentaMesa : calcularVentaMesaSugerida(f.precioVenta, valor, recargoMesaPct),
    }));
  }

  function cambiarVentaEdit(valor: string) {
    setEdit((f) => ({
      ...f,
      precioVenta: valor,
      precioVentaMesa: f.precioVentaMesaManual ? f.precioVentaMesa : calcularVentaMesaSugerida(valor, f.precioCosto, recargoMesaPct),
    }));
  }

  function cambiarVentaMesaEdit(valor: string) {
    setEdit((f) => ({ ...f, precioVentaMesa: valor, precioVentaMesaManual: true }));
  }

  function cancelarEdicion() {
    setEditandoId(null);
    setEdit({ ...emptyForm, precioVentaMesaManual: false });
    setErrorFila("");
  }

  async function guardarEdicion(id: number) {
    setErrorFila("");
    const res = await fetch(`/api/productos/${id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        nombre: edit.nombre,
        codigoBarras: edit.codigoBarras || null,
        categoriaId: edit.categoriaId || null,
        precioVenta: edit.precioVenta,
        precioVentaMesa: edit.precioVentaMesa,
        precioVentaMesaManual: edit.precioVentaMesaManual,
        precioCosto: edit.precioCosto,
        stock: edit.stock,
        unidad: edit.unidad,
        proveedorId: edit.proveedorId || null,
      }),
    });

    if (!res.ok) {
      const data = await res.json();
      setErrorFila(data.error || "Ocurrió un error");
      return;
    }

    cancelarEdicion();
    await cargar();
  }

  async function darDeBaja(id: number) {
    if (!confirm("¿Dar de baja este producto?")) return;
    await fetch(`/api/productos/${id}`, { method: "DELETE" });
    await cargar();
  }

  const listado = useMemo(() => {
    const q = busqueda.trim().toLowerCase();
    return productos.filter((p) => {
      if (!mostrarInactivos && !p.activo) return false;
      if (filtroCategoria && String(p.categoriaId) !== filtroCategoria) return false;
      if (!q) return true;
      return (
        p.nombre.toLowerCase().includes(q) ||
        p.marca?.toLowerCase().includes(q) ||
        p.codigoBarras?.toLowerCase().includes(q) ||
        p.codigoInterno?.toLowerCase().includes(q)
      );
    });
  }, [productos, mostrarInactivos, filtroCategoria, busqueda]);

  const opcionesCategoria = categorias.filter((c) => c.activo || String(c.id) === edit.categoriaId);

  return (
    <div className="max-w-[1400px] mx-auto flex flex-col gap-6">
      <h1 className="text-2xl font-semibold tracking-tight text-neutral-900 dark:text-neutral-50">Productos</h1>

      <ImportarProductos onImportado={cargar} />

      <Plegable titulo="Agregar producto">
        <form onSubmit={agregar} className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <div className="col-span-2">
            <label className={label}>Nombre *</label>
            <input
              className={input}
              value={form.nombre}
              onChange={(e) => setForm({ ...form, nombre: e.target.value })}
              required
            />
          </div>
          <div>
            <label className={label}>Código de barras</label>
            <input
              className={input}
              value={form.codigoBarras}
              onChange={(e) => setForm({ ...form, codigoBarras: e.target.value })}
            />
          </div>
          <div>
            <label className={label}>Categoría</label>
            <select
              className={input}
              value={form.categoriaId}
              onChange={(e) => setForm({ ...form, categoriaId: e.target.value })}
            >
              <option value="">-</option>
              {categorias
                .filter((c) => c.activo)
                .map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.nombre}
                  </option>
                ))}
            </select>
          </div>
          <div>
            <label className={label}>Precio de costo</label>
            <input
              type="number"
              step="0.01"
              className={input}
              value={form.precioCosto}
              onChange={(e) => cambiarCostoNuevo(e.target.value)}
            />
          </div>
          <div>
            <label className={label}>
              Precio de venta *{" "}
              <MargenBadge costo={Number(form.precioCosto)} venta={Number(form.precioVenta)} sugerido={!ventaManual} />
            </label>
            <input
              type="number"
              step="0.01"
              className={input}
              value={form.precioVenta}
              onChange={(e) => cambiarVentaNuevo(e.target.value)}
              required
            />
          </div>
          <div>
            <label className={label}>
              Precio de venta mesa{" "}
              <MargenBadge costo={Number(form.precioCosto)} venta={Number(form.precioVentaMesa)} sugerido={!ventaMesaManual} />
            </label>
            <input
              type="number"
              step="0.01"
              className={input}
              value={form.precioVentaMesa}
              onChange={(e) => cambiarVentaMesaNuevo(e.target.value)}
            />
          </div>
          <div>
            <label className={label}>Stock</label>
            <input
              type="number"
              step="0.01"
              className={input}
              value={form.stock}
              onChange={(e) => setForm({ ...form, stock: e.target.value })}
            />
          </div>
          <div>
            <label className={label}>Unidad</label>
            <input
              className={input}
              value={form.unidad}
              onChange={(e) => setForm({ ...form, unidad: e.target.value })}
              placeholder="unidad, botella, kg..."
            />
          </div>
          <div>
            <label className={label}>Proveedor</label>
            <select
              className={input}
              value={form.proveedorId}
              onChange={(e) => setForm({ ...form, proveedorId: e.target.value })}
            >
              <option value="">-</option>
              {proveedores.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.nombre}
                </option>
              ))}
            </select>
          </div>

          <div className="col-span-2 md:col-span-4 flex items-center gap-3 pt-1">
            <Button type="submit" variant="primary">
              Agregar producto
            </Button>
            {error && <span className="text-sm text-red-400">{error}</span>}
          </div>
        </form>
      </Plegable>

      <Card>
        <div className="flex flex-col gap-3 p-3 border-b border-neutral-200 dark:border-neutral-800">
          <div className="flex flex-col sm:flex-row gap-2">
            <input
              className={`${input} flex-1`}
              placeholder="Buscar por nombre, marca o código..."
              value={busqueda}
              onChange={(e) => setBusqueda(e.target.value)}
            />
            <select
              className={`${input} sm:max-w-[200px]`}
              value={filtroCategoria}
              onChange={(e) => setFiltroCategoria(e.target.value)}
            >
              <option value="">Todas las categorías</option>
              {categorias.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.nombre}
                </option>
              ))}
            </select>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-sm text-neutral-500 dark:text-neutral-400">{listado.length} producto(s)</span>
            <label className="flex items-center gap-2 text-sm text-neutral-500 dark:text-neutral-400">
              <input
                type="checkbox"
                checked={mostrarInactivos}
                onChange={(e) => setMostrarInactivos(e.target.checked)}
              />
              Mostrar dados de baja
            </label>
          </div>
          {errorFila && <span className="text-sm text-red-400">{errorFila}</span>}
        </div>
        {loading ? (
          <div className="p-4 text-sm text-neutral-500">Cargando...</div>
        ) : (
          <div className="overflow-auto max-h-[70vh]">
            <table className="w-full">
              <thead className="sticky top-0 z-10 bg-white dark:bg-neutral-900 border-b border-neutral-200 dark:border-neutral-800">
                <tr>
                  <th className={th}>Nombre</th>
                  <th className={th}>Costo</th>
                  <th className={th}>Precio venta</th>
                  <th className={th}>Precio venta mesa</th>
                  <th className={th}>Stock</th>
                  <th className={th}>Código</th>
                  <th className={th}>Categoría</th>
                  <th className={th}>Unidad</th>
                  <th className={th}>Proveedor</th>
                  <th className={th}>Última modificación</th>
                  <th className={`${th} w-40 sticky right-0 bg-white dark:bg-neutral-900 border-l border-neutral-200 dark:border-neutral-800`}></th>
                </tr>
              </thead>
              <tbody>
                {listado.map((p) =>
                  editandoId === p.id ? (
                    <tr key={p.id} className={trHover}>
                      <td className={td}>
                        <input
                          className={input}
                          value={edit.nombre}
                          onChange={(e) => setEdit({ ...edit, nombre: e.target.value })}
                        />
                      </td>
                      <td className={td}>
                        <input
                          type="number"
                          step="0.01"
                          className={`${input} min-w-[100px]`}
                          value={edit.precioCosto}
                          onChange={(e) => cambiarCostoEdit(e.target.value)}
                        />
                      </td>
                      <td className={td}>
                        <input
                          type="number"
                          step="0.01"
                          className={`${input} min-w-[100px]`}
                          value={edit.precioVenta}
                          onChange={(e) => cambiarVentaEdit(e.target.value)}
                        />
                        <div className="mt-0.5">
                          <MargenBadge costo={Number(edit.precioCosto)} venta={Number(edit.precioVenta)} small />
                        </div>
                      </td>
                      <td className={td}>
                        <div className="flex items-start gap-1">
                          <input
                            type="number"
                            step="0.01"
                            className={`${input} min-w-[100px]`}
                            value={edit.precioVentaMesa}
                            onChange={(e) => cambiarVentaMesaEdit(e.target.value)}
                          />
                          {edit.precioVentaMesaManual && (
                            <span
                              className="text-amber-500 text-base leading-none pt-1.5 shrink-0"
                              title="Precio fijado a mano: no se actualiza solo cuando cambia el % de recargo de mesa en Configuración. Revisalo."
                            >
                              ⚠️
                            </span>
                          )}
                        </div>
                        <div className="mt-0.5">
                          <MargenBadge
                            costo={Number(edit.precioCosto)}
                            venta={Number(edit.precioVentaMesa)}
                            sugerido={!edit.precioVentaMesaManual}
                            small
                          />
                        </div>
                      </td>
                      <td className={td}>
                        <input
                          type="number"
                          step="0.01"
                          className={`${input} min-w-[80px]`}
                          value={edit.stock}
                          onChange={(e) => setEdit({ ...edit, stock: e.target.value })}
                        />
                      </td>
                      <td className={td}>
                        <input
                          className={input}
                          value={edit.codigoBarras}
                          onChange={(e) => setEdit({ ...edit, codigoBarras: e.target.value })}
                        />
                      </td>
                      <td className={td}>
                        <select
                          className={input}
                          value={edit.categoriaId}
                          onChange={(e) => setEdit({ ...edit, categoriaId: e.target.value })}
                        >
                          <option value="">-</option>
                          {opcionesCategoria.map((c) => (
                            <option key={c.id} value={c.id}>
                              {c.nombre}
                            </option>
                          ))}
                        </select>
                      </td>
                      <td className={td}>
                        <input
                          className={`${input} min-w-[80px]`}
                          value={edit.unidad}
                          onChange={(e) => setEdit({ ...edit, unidad: e.target.value })}
                        />
                      </td>
                      <td className={td}>
                        <select
                          className={input}
                          value={edit.proveedorId}
                          onChange={(e) => setEdit({ ...edit, proveedorId: e.target.value })}
                        >
                          <option value="">-</option>
                          {proveedores.map((pr) => (
                            <option key={pr.id} value={pr.id}>
                              {pr.nombre}
                            </option>
                          ))}
                        </select>
                      </td>
                      <td className={`${td} text-xs text-neutral-500`}>
                        {new Date(p.updatedAt).toLocaleString("es-AR")}
                      </td>
                      <td
                        className={`${td} text-right whitespace-nowrap gap-3 sticky right-0 bg-white dark:bg-neutral-900 border-l border-neutral-200 dark:border-neutral-800`}
                      >
                        <button
                          className="text-blue-500 hover:text-blue-400"
                          onClick={() => guardarEdicion(p.id)}
                        >
                          Guardar
                        </button>
                        <span className="mx-2">|</span>
                        <button className="text-neutral-500 dark:text-neutral-400 hover:text-neutral-700 dark:hover:text-neutral-200" onClick={cancelarEdicion}>
                          Cancelar
                        </button>
                      </td>
                    </tr>
                  ) : (
                    <tr key={p.id} className={`${trHover} ${!p.activo ? "opacity-40" : ""}`}>
                      <td className={`${td} text-neutral-900 dark:text-neutral-50 font-medium`}>{p.nombre}</td>
                      <td className={`${td} text-neutral-500 dark:text-neutral-400`}>${formatearMoneda(p.precioCosto)}</td>
                      <td className={`${td} text-emerald-400 font-medium`}>
                        ${formatearMoneda(p.precioVenta)}{" "}
                        <MargenBadge costo={p.precioCosto} venta={p.precioVenta} compacto small />
                      </td>
                      <td className={`${td} text-blue-400 font-medium`}>
                        ${formatearMoneda(p.precioVentaMesa)}{" "}
                        <MargenBadge costo={p.precioCosto} venta={p.precioVentaMesa} compacto small />
                      </td>
                      <td
                        className={`${td} font-medium ${
                          p.stock <= 0 ? "text-red-400" : p.stock <= 5 ? "text-blue-500" : "text-neutral-700 dark:text-neutral-200"
                        }`}
                      >
                        {p.stock}
                      </td>
                      <td className={`${td} font-mono text-xs text-neutral-500`}>{p.codigoBarras || "-"}</td>
                      <td className={`${td} text-neutral-500 dark:text-neutral-400`}>{p.categoria?.nombre || "-"}</td>
                      <td className={`${td} text-neutral-500`}>{p.unidad}</td>
                      <td className={`${td} text-neutral-500 dark:text-neutral-400`}>{p.proveedor?.nombre || "-"}</td>
                      <td className={`${td} text-xs text-neutral-500 whitespace-nowrap`}>
                        {new Date(p.updatedAt).toLocaleString("es-AR")}
                      </td>
                      <td
                        className={`${td} text-right whitespace-nowrap sticky right-0 bg-white dark:bg-neutral-900 border-l border-neutral-200 dark:border-neutral-800`}
                      >
                        <button
                          className="text-blue-500 hover:text-blue-400 mr-3"
                          onClick={() => iniciarEdicion(p)}
                        >
                          Editar
                        </button>
                        {p.activo ? (
                          <button className="text-red-400 hover:text-red-300" onClick={() => darDeBaja(p.id)}>
                            Dar de baja
                          </button>
                        ) : (
                          <Badge variant="neutral">Baja</Badge>
                        )}
                      </td>
                    </tr>
                  )
                )}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </div>
  );
}
