"use client";

import { useEffect, useState } from "react";
import BuscadorProducto, { ProductoBusqueda } from "@/components/BuscadorProducto";
import Card from "@/components/ui/Card";
import Button from "@/components/ui/Button";
import Badge from "@/components/ui/Badge";
import { input, label, th, td, trHover } from "@/components/ui/styles";
import { formatearMoneda } from "@/lib/formato";

const STOCK_BAJO = 5;

type Proveedor = { id: number; nombre: string };

type Producto = ProductoBusqueda & {
  precioCosto: number;
  proveedorId: number | null;
  activo: boolean;
};

type ItemCarga = {
  productoId: number;
  nombre: string;
  cantidad: string;
  costoUnitario: string;
};

export default function StockPage() {
  const [productos, setProductos] = useState<Producto[]>([]);
  const [proveedores, setProveedores] = useState<Proveedor[]>([]);
  const [proveedorId, setProveedorId] = useState("");
  const [tipo, setTipo] = useState<"ENTRADA" | "AJUSTE">("ENTRADA");
  const [notas, setNotas] = useState("");
  const [items, setItems] = useState<ItemCarga[]>([]);
  const [error, setError] = useState("");
  const [ok, setOk] = useState("");
  const [loading, setLoading] = useState(true);
  const [filtroStock, setFiltroStock] = useState("");

  async function cargar() {
    setLoading(true);
    const [prodRes, provRes] = await Promise.all([
      fetch("/api/productos"),
      fetch("/api/proveedores"),
    ]);
    setProductos(await prodRes.json());
    setProveedores(await provRes.json());
    setLoading(false);
  }

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- carga inicial de datos al montar la página
    cargar();
  }, []);

  function agregarItem(p: ProductoBusqueda) {
    setItems((prev) => {
      if (prev.some((i) => i.productoId === p.id)) return prev;
      const producto = productos.find((x) => x.id === p.id);
      return [
        ...prev,
        {
          productoId: p.id,
          nombre: p.nombre,
          cantidad: "1",
          costoUnitario: producto ? String(producto.precioCosto) : "0",
        },
      ];
    });
  }

  function actualizarItem(productoId: number, campo: "cantidad" | "costoUnitario", valor: string) {
    setItems((prev) => prev.map((i) => (i.productoId === productoId ? { ...i, [campo]: valor } : i)));
  }

  function quitarItem(productoId: number) {
    setItems((prev) => prev.filter((i) => i.productoId !== productoId));
  }

  async function confirmar() {
    setError("");
    setOk("");
    if (items.length === 0) {
      setError("Agregá al menos un producto");
      return;
    }

    const res = await fetch("/api/stock/entradas", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        proveedorId: proveedorId || null,
        tipo,
        notas,
        items: items.map((i) => ({
          productoId: i.productoId,
          cantidad: Number(i.cantidad),
          costoUnitario: Number(i.costoUnitario),
        })),
      }),
    });

    if (!res.ok) {
      const data = await res.json();
      setError(data.error || "Ocurrió un error");
      return;
    }

    setItems([]);
    setNotas("");
    setOk("Stock cargado correctamente");
    await cargar();
  }

  const stockOrdenado = [...productos]
    .filter((p) => p.activo)
    .filter((p) => {
      if (!filtroStock.trim()) return true;
      const q = filtroStock.toLowerCase();
      return p.nombre.toLowerCase().includes(q);
    })
    .sort((a, b) => (a.stock ?? 0) - (b.stock ?? 0));

  return (
    <div className="max-w-5xl mx-auto flex flex-col gap-6">
      <h1 className="text-2xl font-semibold tracking-tight text-neutral-50">Carga de stock</h1>

      <Card className="p-4 flex flex-col gap-3">
        <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
          <div>
            <label className={label}>Proveedor</label>
            <select className={input} value={proveedorId} onChange={(e) => setProveedorId(e.target.value)}>
              <option value="">-</option>
              {proveedores.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.nombre}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className={label}>Tipo</label>
            <select className={input} value={tipo} onChange={(e) => setTipo(e.target.value as "ENTRADA" | "AJUSTE")}>
              <option value="ENTRADA">Entrada (compra a proveedor)</option>
              <option value="AJUSTE">Ajuste (corrección de stock)</option>
            </select>
          </div>
          <div>
            <label className={label}>Notas</label>
            <input className={input} value={notas} onChange={(e) => setNotas(e.target.value)} />
          </div>
        </div>

        <BuscadorProducto productos={productos} onSeleccionar={agregarItem} elegirPrecio={false} />

        {items.length > 0 && (
          <div className="overflow-x-auto -mx-1">
            <table className="w-full mt-1">
              <thead>
                <tr>
                  <th className={th}>Producto</th>
                  <th className={`${th} w-32`}>Cantidad</th>
                  <th className={`${th} w-32`}>Costo unitario</th>
                  <th className={th}></th>
                </tr>
              </thead>
              <tbody>
                {items.map((i) => (
                  <tr key={i.productoId} className={trHover}>
                    <td className={td}>{i.nombre}</td>
                    <td className={td}>
                      <input
                        type="number"
                        step="0.01"
                        className={input}
                        value={i.cantidad}
                        onChange={(e) => actualizarItem(i.productoId, "cantidad", e.target.value)}
                      />
                    </td>
                    <td className={td}>
                      <input
                        type="number"
                        step="0.01"
                        className={input}
                        value={i.costoUnitario}
                        onChange={(e) => actualizarItem(i.productoId, "costoUnitario", e.target.value)}
                      />
                    </td>
                    <td className={`${td} text-right`}>
                      <button className="text-red-400 hover:text-red-300" onClick={() => quitarItem(i.productoId)}>
                        Quitar
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        <div className="flex items-center gap-3 pt-1">
          <Button onClick={confirmar} variant="primary" disabled={items.length === 0}>
            Confirmar carga
          </Button>
          {error && <span className="text-sm text-red-400">{error}</span>}
          {ok && <span className="text-sm text-emerald-400">{ok}</span>}
        </div>
      </Card>

      <Card>
        <div className="p-3 border-b border-neutral-800 flex items-center justify-between">
          <span className="text-sm text-neutral-400">Stock actual</span>
          <input
            type="text"
            placeholder="Buscar producto..."
            value={filtroStock}
            onChange={(e) => setFiltroStock(e.target.value)}
            className={`${input} w-48`}
          />
        </div>
        {loading ? (
          <div className="p-4 text-sm text-neutral-500">Cargando...</div>
        ) : (
          <div className="overflow-auto max-h-[70vh]">
            <table className="w-full">
              <thead className="sticky top-0 z-10 bg-white dark:bg-neutral-900 border-b border-neutral-200 dark:border-neutral-800">
                <tr>
                  <th className={th}>Producto</th>
                  <th className={th}>Stock</th>
                  <th className={th}>Costo</th>
                  <th className={th}>Venta</th>
                </tr>
              </thead>
              <tbody>
                {stockOrdenado.map((p) => (
                  <tr key={p.id} className={`${trHover} ${(p.stock ?? 0) <= STOCK_BAJO ? "bg-red-500/5" : ""}`}>
                    <td className={td}>{p.nombre}</td>
                    <td className={td}>
                      <span className="mr-2">
                        {p.stock} {p.unidad}
                      </span>
                      {(p.stock ?? 0) <= STOCK_BAJO && <Badge variant="danger">Stock bajo</Badge>}
                    </td>
                    <td className={td}>${formatearMoneda(p.precioCosto)}</td>
                    <td className={td}>${formatearMoneda(p.precioVenta ?? 0)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </div>
  );
}
