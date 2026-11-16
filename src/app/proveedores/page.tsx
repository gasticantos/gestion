"use client";

import { ChangeEvent, FormEvent, useEffect, useMemo, useState } from "react";
import BuscadorProducto, { ProductoBusqueda } from "@/components/BuscadorProducto";
import Card from "@/components/ui/Card";
import Button from "@/components/ui/Button";
import Badge from "@/components/ui/Badge";
import { input, label, th, td, trHover } from "@/components/ui/styles";
import { fechaArgentinaYMD, formatearFechaHora, formatearMoneda } from "@/lib/formato";

type Proveedor = { id: number; nombre: string; telefono: string | null; contacto: string | null; notas: string | null; activo: boolean };
type Producto = ProductoBusqueda & { precioCosto: number; activo: boolean };
type ItemCarga = { productoId: number; nombre: string; cantidad: string; costoUnitario: string; costoAnterior: number };
type ItemFactura = { id: number; productoNombre: string; cantidad: number; costoAnterior: number; costoUnitario: number; precioVentaAnterior: number; precioVentaSugerido: number | null; requiereAumento: boolean; precioActualizado: boolean };
type Factura = { id: number; numero: string | null; fecha: string; total: number; saldo: number; estado: "PAGADA" | "CUENTA_CORRIENTE"; comprobante: string | null; notas: string | null; proveedor: { id: number; nombre: string }; items: ItemFactura[] };
type Deuda = { id: number; nombre: string; deuda: number };

const emptyProveedor = { id: null as number | null, nombre: "", telefono: "", contacto: "", notas: "" };
const emptyFactura = { proveedorId: "", numero: "", fecha: fechaArgentinaYMD(), estado: "CUENTA_CORRIENTE" as "PAGADA" | "CUENTA_CORRIENTE", notas: "" };

async function reducirFoto(archivo: File): Promise<string> {
  if (!archivo.type.startsWith("image/")) throw new Error("Elegí una imagen de la factura");
  const url = URL.createObjectURL(archivo);
  try {
    const imagen = await new Promise<HTMLImageElement>((resolve, reject) => {
      const img = new Image(); img.onload = () => resolve(img); img.onerror = reject; img.src = url;
    });
    const escala = Math.min(1, 1800 / Math.max(imagen.width, imagen.height));
    const canvas = document.createElement("canvas");
    canvas.width = Math.round(imagen.width * escala); canvas.height = Math.round(imagen.height * escala);
    canvas.getContext("2d")?.drawImage(imagen, 0, 0, canvas.width, canvas.height);
    return canvas.toDataURL("image/webp", 0.78);
  } finally { URL.revokeObjectURL(url); }
}

export default function ProveedoresPage() {
  const [seccion, setSeccion] = useState<"facturas" | "cuentas" | "proveedores">("facturas");
  const [proveedores, setProveedores] = useState<Proveedor[]>([]);
  const [productos, setProductos] = useState<Producto[]>([]);
  const [facturas, setFacturas] = useState<Factura[]>([]);
  const [deudas, setDeudas] = useState<Deuda[]>([]);
  const [formProveedor, setFormProveedor] = useState(emptyProveedor);
  const [formFactura, setFormFactura] = useState(emptyFactura);
  const [items, setItems] = useState<ItemCarga[]>([]);
  const [comprobante, setComprobante] = useState<string | null>(null);
  const [procesandoFoto, setProcesandoFoto] = useState(false);
  const [mostrarInactivos, setMostrarInactivos] = useState(false);
  const [pago, setPago] = useState({ proveedorId: "", monto: "", notas: "" });
  const [loading, setLoading] = useState(true);
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState("");
  const [ok, setOk] = useState("");

  async function cargar() {
    setLoading(true);
    const [provRes, prodRes, factRes] = await Promise.all([
      fetch("/api/proveedores", { cache: "no-store" }), fetch("/api/productos", { cache: "no-store" }), fetch("/api/proveedores/facturas", { cache: "no-store" }),
    ]);
    if (provRes.ok) setProveedores(await provRes.json());
    if (prodRes.ok) setProductos(await prodRes.json());
    if (factRes.ok) { const data = await factRes.json(); setFacturas(data.facturas); setDeudas(data.deudas); }
    setLoading(false);
  }
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- carga inicial desde las APIs del módulo
    void cargar();
  }, []);
  const totalFactura = useMemo(() => items.reduce((s, i) => s + (Number(i.cantidad) || 0) * (Number(i.costoUnitario) || 0), 0), [items]);
  const deudaTotal = deudas.reduce((s, p) => s + p.deuda, 0);
  const alertas = facturas.flatMap((f) => f.items.filter((i) => i.requiereAumento && !i.precioActualizado).map((i) => ({ ...i, facturaId: f.id })));

  function agregarItem(p: ProductoBusqueda) {
    const producto = productos.find((x) => x.id === p.id); if (!producto) return;
    setItems((actuales) => actuales.some((i) => i.productoId === p.id) ? actuales : [...actuales, { productoId: p.id, nombre: p.nombre, cantidad: "1", costoUnitario: String(producto.precioCosto), costoAnterior: producto.precioCosto }]);
  }
  function cambiarItem(id: number, campo: "cantidad" | "costoUnitario", valor: string) { setItems((actuales) => actuales.map((i) => i.productoId === id ? { ...i, [campo]: valor } : i)); }
  async function elegirFoto(e: ChangeEvent<HTMLInputElement>) {
    const archivo = e.target.files?.[0]; if (!archivo) return; setError(""); setProcesandoFoto(true);
    try { setComprobante(await reducirFoto(archivo)); } catch (err) { setError(err instanceof Error ? err.message : "No se pudo leer la foto"); }
    finally { setProcesandoFoto(false); e.target.value = ""; }
  }
  async function guardarFactura() {
    setError(""); setOk("");
    if (!formFactura.proveedorId || items.length === 0) { setError("Elegí un proveedor y agregá al menos un producto"); return; }
    setGuardando(true);
    const res = await fetch("/api/proveedores/facturas", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ ...formFactura, comprobante, items: items.map((i) => ({ productoId: i.productoId, cantidad: Number(i.cantidad), costoUnitario: Number(i.costoUnitario) })) }) });
    const data = await res.json(); setGuardando(false);
    if (!res.ok) { setError(data.error || "No se pudo guardar la factura"); return; }
    const aumentos = data.items.filter((i: ItemFactura) => i.requiereAumento).length;
    setFormFactura(emptyFactura); setItems([]); setComprobante(null);
    setOk(`Factura cargada. Stock y costos actualizados${aumentos ? `. Hay ${aumentos} precio(s) de venta para revisar.` : "."}`); await cargar();
  }
  async function aplicarPrecios(facturaId: number) {
    if (!confirm("¿Actualizar los precios de venta sugeridos de esta factura?")) return;
    const res = await fetch(`/api/proveedores/facturas/${facturaId}/precios`, { method: "PATCH" }); const data = await res.json();
    if (!res.ok) { setError(data.error || "No se pudieron actualizar los precios"); return; }
    setOk(`${data.actualizados} precio(s) de venta actualizado(s)`); await cargar();
  }
  async function registrarPago(e: FormEvent) {
    e.preventDefault(); setError(""); setOk("");
    const res = await fetch("/api/proveedores/pagos", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(pago) }); const data = await res.json();
    if (!res.ok) { setError(data.error || "No se pudo registrar el pago"); return; }
    setPago({ proveedorId: "", monto: "", notas: "" }); setOk("Pago registrado y deuda actualizada"); await cargar();
  }
  async function guardarProveedor(e: FormEvent) {
    e.preventDefault(); setError("");
    const res = await fetch(formProveedor.id ? `/api/proveedores/${formProveedor.id}` : "/api/proveedores", { method: formProveedor.id ? "PUT" : "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(formProveedor) }); const data = await res.json();
    if (!res.ok) { setError(data.error || "Ocurrió un error"); return; }
    setFormProveedor(emptyProveedor); setOk("Proveedor guardado"); await cargar();
  }
  async function darDeBaja(id: number) { if (!confirm("¿Dar de baja este proveedor?")) return; await fetch(`/api/proveedores/${id}`, { method: "DELETE" }); await cargar(); }

  const tabs = [{ id: "facturas", texto: "Cargar factura" }, { id: "cuentas", texto: `Cuentas corrientes${deudaTotal ? ` · $${formatearMoneda(deudaTotal)}` : ""}` }, { id: "proveedores", texto: "Datos de proveedores" }] as const;
  return <div className="max-w-6xl mx-auto flex flex-col gap-5">
    <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-3"><div><h1 className="text-2xl font-semibold tracking-tight">Proveedores</h1><p className="text-sm text-neutral-500 mt-1">Facturas, mercadería y cuentas corrientes en un solo lugar.</p></div><div className="flex gap-1 rounded-xl bg-neutral-100 dark:bg-neutral-900 p-1 overflow-x-auto">{tabs.map((tab) => <button key={tab.id} onClick={() => { setSeccion(tab.id); setError(""); setOk(""); }} className={`px-3 py-2 rounded-lg text-sm font-medium whitespace-nowrap ${seccion === tab.id ? "bg-white dark:bg-neutral-800 shadow-sm text-blue-600" : "text-neutral-500"}`}>{tab.texto}</button>)}</div></div>
    {(error || ok) && <div className={`rounded-lg border px-4 py-3 text-sm ${error ? "border-red-500/30 bg-red-500/10 text-red-500" : "border-emerald-500/30 bg-emerald-500/10 text-emerald-600"}`}>{error || ok}</div>}

    {seccion === "facturas" && <>
      {alertas.length > 0 && <Card className="p-4 border-amber-400/40 bg-amber-50 dark:bg-amber-950/20"><div className="flex items-center justify-between gap-3 mb-3"><div><h2 className="font-semibold text-amber-800 dark:text-amber-300">Precios que conviene aumentar</h2><p className="text-xs text-amber-700/70 dark:text-amber-300/70">El costo subió en la última compra.</p></div><Badge variant="warning">{alertas.length} pendientes</Badge></div><div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-2">{alertas.slice(0, 6).map((a) => <div key={a.id} className="rounded-lg border border-amber-300/40 bg-white/70 dark:bg-neutral-900/60 p-3 text-sm"><div className="font-medium">{a.productoNombre}</div><div className="text-neutral-500 mt-1">Venta: ${formatearMoneda(a.precioVentaAnterior)} → <strong className="text-amber-700 dark:text-amber-300">${formatearMoneda(a.precioVentaSugerido || 0)}</strong></div><button onClick={() => aplicarPrecios(a.facturaId)} className="text-blue-600 text-xs font-medium mt-2">Aplicar precios de esta factura</button></div>)}</div></Card>}
      <Card className="p-4 sm:p-5 flex flex-col gap-4"><div><h2 className="font-semibold">Nueva factura</h2><p className="text-xs text-neutral-500 mt-1">Al guardarla se sumará el stock, se actualizarán los costos y se registrará la deuda.</p></div>
        <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-3"><div><label className={label}>Proveedor *</label><select className={input} value={formFactura.proveedorId} onChange={(e) => setFormFactura({ ...formFactura, proveedorId: e.target.value })}><option value="">Elegir...</option>{proveedores.filter((p) => p.activo).map((p) => <option key={p.id} value={p.id}>{p.nombre}</option>)}</select></div><div><label className={label}>N.º de factura</label><input className={input} placeholder="Ej. 0001-000123" value={formFactura.numero} onChange={(e) => setFormFactura({ ...formFactura, numero: e.target.value })} /></div><div><label className={label}>Fecha *</label><input type="date" className={input} value={formFactura.fecha} onChange={(e) => setFormFactura({ ...formFactura, fecha: e.target.value })} /></div><div><label className={label}>Condición *</label><select className={input} value={formFactura.estado} onChange={(e) => setFormFactura({ ...formFactura, estado: e.target.value as "PAGADA" | "CUENTA_CORRIENTE" })}><option value="CUENTA_CORRIENTE">A cuenta corriente</option><option value="PAGADA">Pagada</option></select></div></div>
        <BuscadorProducto productos={productos.filter((p) => p.activo)} onSeleccionar={agregarItem} elegirPrecio={false} placeholder="Buscar producto para agregar..." />
        {items.length > 0 && <div className="overflow-x-auto"><table className="w-full"><thead><tr><th className={th}>Producto</th><th className={`${th} w-28`}>Cantidad</th><th className={`${th} w-40`}>Costo anterior</th><th className={`${th} w-40`}>Nuevo costo</th><th className={`${th} w-32`}>Subtotal</th><th className={th}></th></tr></thead><tbody>{items.map((i) => <tr key={i.productoId} className={trHover}><td className={td}>{i.nombre}</td><td className={td}><input type="number" min="0.01" step="0.01" className={input} value={i.cantidad} onChange={(e) => cambiarItem(i.productoId, "cantidad", e.target.value)} /></td><td className={`${td} text-neutral-500`}>${formatearMoneda(i.costoAnterior)}</td><td className={td}><input type="number" min="0" step="0.01" className={input} value={i.costoUnitario} onChange={(e) => cambiarItem(i.productoId, "costoUnitario", e.target.value)} /></td><td className={`${td} font-medium`}>${formatearMoneda((Number(i.cantidad) || 0) * (Number(i.costoUnitario) || 0))}</td><td className={td}><button className="text-red-500 text-sm" onClick={() => setItems((x) => x.filter((item) => item.productoId !== i.productoId))}>Quitar</button></td></tr>)}</tbody></table></div>}
        <div className="grid sm:grid-cols-2 gap-3 items-start"><div><label className={label}>Foto de la factura</label><div className="flex items-center gap-3"><label className="cursor-pointer inline-flex rounded-lg border border-neutral-300 dark:border-neutral-700 px-3 py-2 text-sm font-medium hover:bg-neutral-50 dark:hover:bg-neutral-800"><input type="file" accept="image/*" capture="environment" className="hidden" onChange={elegirFoto} />{procesandoFoto ? "Procesando..." : comprobante ? "Cambiar foto" : "Sacar o elegir foto"}</label>{comprobante && <><button onClick={() => setComprobante(null)} className="text-xs text-red-500">Quitar</button><button onClick={() => window.open(comprobante, "_blank")} className="text-xs text-blue-600">Ver foto</button></>}</div></div><div><label className={label}>Notas</label><input className={input} value={formFactura.notas} onChange={(e) => setFormFactura({ ...formFactura, notas: e.target.value })} /></div></div>
        <div className="flex flex-wrap items-center justify-between gap-3 pt-3 border-t border-neutral-200 dark:border-neutral-800"><div><span className="text-sm text-neutral-500">Total de factura</span><div className="text-2xl font-semibold">${formatearMoneda(totalFactura)}</div></div><Button variant="primary" onClick={guardarFactura} disabled={guardando || procesandoFoto || items.length === 0}>{guardando ? "Guardando..." : "Guardar factura y actualizar stock"}</Button></div>
      </Card><Historial facturas={facturas} loading={loading} aplicarPrecios={aplicarPrecios} />
    </>}

    {seccion === "cuentas" && <div className="grid lg:grid-cols-[1fr_360px] gap-5 items-start"><Card><div className="p-4 border-b border-neutral-200 dark:border-neutral-800"><h2 className="font-semibold">Deuda por proveedor</h2><p className="text-sm text-neutral-500">Total pendiente: <strong>${formatearMoneda(deudaTotal)}</strong></p></div><div className="divide-y divide-neutral-200 dark:divide-neutral-800">{deudas.filter((d) => d.deuda > 0).map((d) => <button key={d.id} onClick={() => setPago({ ...pago, proveedorId: String(d.id), monto: String(d.deuda) })} className="w-full p-4 flex justify-between items-center hover:bg-neutral-50 dark:hover:bg-neutral-800/50"><span className="font-medium">{d.nombre}</span><span className="text-lg font-semibold text-red-500">${formatearMoneda(d.deuda)}</span></button>)}{!loading && !deudas.some((d) => d.deuda > 0) && <div className="p-8 text-center text-neutral-500">No hay cuentas pendientes.</div>}</div></Card><Card className="p-4"><h2 className="font-semibold mb-4">Registrar pago</h2><form onSubmit={registrarPago} className="flex flex-col gap-3"><div><label className={label}>Proveedor</label><select required className={input} value={pago.proveedorId} onChange={(e) => setPago({ ...pago, proveedorId: e.target.value, monto: "" })}><option value="">Elegir...</option>{deudas.filter((d) => d.deuda > 0).map((d) => <option key={d.id} value={d.id}>{d.nombre} · ${formatearMoneda(d.deuda)}</option>)}</select></div><div><label className={label}>Monto</label><input required type="number" min="0.01" step="0.01" className={input} value={pago.monto} onChange={(e) => setPago({ ...pago, monto: e.target.value })} /></div><div><label className={label}>Nota</label><input className={input} value={pago.notas} onChange={(e) => setPago({ ...pago, notas: e.target.value })} /></div><Button type="submit" variant="primary">Registrar pago</Button></form></Card><div className="lg:col-span-2"><Historial facturas={facturas.filter((f) => f.saldo > 0)} loading={loading} aplicarPrecios={aplicarPrecios} titulo="Facturas pendientes" /></div></div>}

    {seccion === "proveedores" && <><Card className="p-4"><form onSubmit={guardarProveedor} className="grid sm:grid-cols-2 gap-3"><div><label className={label}>Nombre *</label><input required className={input} value={formProveedor.nombre} onChange={(e) => setFormProveedor({ ...formProveedor, nombre: e.target.value })} /></div><div><label className={label}>Teléfono</label><input className={input} value={formProveedor.telefono} onChange={(e) => setFormProveedor({ ...formProveedor, telefono: e.target.value })} /></div><div><label className={label}>Contacto</label><input className={input} value={formProveedor.contacto} onChange={(e) => setFormProveedor({ ...formProveedor, contacto: e.target.value })} /></div><div><label className={label}>Notas</label><input className={input} value={formProveedor.notas} onChange={(e) => setFormProveedor({ ...formProveedor, notas: e.target.value })} /></div><div className="sm:col-span-2 flex gap-2"><Button type="submit" variant="primary">{formProveedor.id ? "Guardar cambios" : "Agregar proveedor"}</Button>{formProveedor.id && <Button type="button" variant="ghost" onClick={() => setFormProveedor(emptyProveedor)}>Cancelar</Button>}</div></form></Card><Card><div className="p-3 border-b border-neutral-200 dark:border-neutral-800 flex justify-between"><span className="text-sm text-neutral-500">{proveedores.length} proveedor(es)</span><label className="text-sm text-neutral-500 flex gap-2"><input type="checkbox" checked={mostrarInactivos} onChange={(e) => setMostrarInactivos(e.target.checked)} /> Mostrar bajas</label></div><div className="overflow-x-auto"><table className="w-full"><thead><tr><th className={th}>Nombre</th><th className={th}>Teléfono</th><th className={th}>Contacto</th><th className={th}>Notas</th><th className={th}></th></tr></thead><tbody>{proveedores.filter((p) => mostrarInactivos || p.activo).map((p) => <tr key={p.id} className={`${trHover} ${!p.activo ? "opacity-40" : ""}`}><td className={td}>{p.nombre}</td><td className={td}>{p.telefono || "-"}</td><td className={td}>{p.contacto || "-"}</td><td className={td}>{p.notas || "-"}</td><td className={`${td} text-right whitespace-nowrap`}><button className="text-blue-600 mr-3" onClick={() => setFormProveedor({ id: p.id, nombre: p.nombre, telefono: p.telefono || "", contacto: p.contacto || "", notas: p.notas || "" })}>Editar</button>{p.activo ? <button className="text-red-500" onClick={() => darDeBaja(p.id)}>Dar de baja</button> : <Badge>Baja</Badge>}</td></tr>)}</tbody></table></div></Card></>}
  </div>;
}

function Historial({ facturas, loading, aplicarPrecios, titulo = "Últimas facturas" }: { facturas: Factura[]; loading: boolean; aplicarPrecios: (id: number) => void; titulo?: string }) {
  const [abierta, setAbierta] = useState<number | null>(null);
  return <Card><div className="p-4 border-b border-neutral-200 dark:border-neutral-800"><h2 className="font-semibold">{titulo}</h2></div>{loading ? <div className="p-4 text-neutral-500">Cargando...</div> : <div className="divide-y divide-neutral-200 dark:divide-neutral-800">{facturas.map((f) => { const pendientes = f.items.filter((i) => i.requiereAumento && !i.precioActualizado); return <div key={f.id}><button onClick={() => setAbierta(abierta === f.id ? null : f.id)} className="w-full p-4 grid grid-cols-[1fr_auto] sm:grid-cols-[1.5fr_1fr_1fr_auto] gap-2 text-left items-center hover:bg-neutral-50 dark:hover:bg-neutral-800/40"><div><div className="font-medium">{f.proveedor.nombre}</div><div className="text-xs text-neutral-500">{new Date(f.fecha).toLocaleDateString("es-AR", { timeZone: "America/Argentina/Cordoba" })} · {f.numero || `Factura #${f.id}`}</div></div><div className="hidden sm:block"><Badge variant={f.saldo === 0 ? "success" : "danger"}>{f.saldo === 0 ? "Pagada" : `Debe $${formatearMoneda(f.saldo)}`}</Badge></div><div className="hidden sm:block font-semibold">${formatearMoneda(f.total)}</div><div className="flex items-center gap-2">{pendientes.length > 0 && <Badge variant="warning">{pendientes.length} precio(s)</Badge>}<span className="text-neutral-400">{abierta === f.id ? "▲" : "▼"}</span></div></button>{abierta === f.id && <div className="px-4 pb-4 bg-neutral-50/60 dark:bg-neutral-950/30"><div className="overflow-x-auto"><table className="w-full"><thead><tr><th className={th}>Producto</th><th className={th}>Cantidad</th><th className={th}>Costo</th><th className={th}>Venta / sugerido</th></tr></thead><tbody>{f.items.map((i) => <tr key={i.id}><td className={td}>{i.productoNombre}</td><td className={td}>{i.cantidad}</td><td className={td}>${formatearMoneda(i.costoAnterior)} → ${formatearMoneda(i.costoUnitario)}</td><td className={td}>${formatearMoneda(i.precioVentaAnterior)}{i.precioVentaSugerido && i.requiereAumento ? <> → <strong className={i.precioActualizado ? "text-emerald-600" : "text-amber-600"}>${formatearMoneda(i.precioVentaSugerido)}</strong></> : ""}</td></tr>)}</tbody></table></div><div className="flex flex-wrap gap-3 mt-3 items-center">{f.comprobante && <button onClick={() => window.open(f.comprobante!, "_blank")} className="text-sm text-blue-600 font-medium">Ver foto de la factura</button>}{pendientes.length > 0 && <Button size="sm" variant="primary" onClick={() => aplicarPrecios(f.id)}>Aplicar precios sugeridos</Button>}<span className="text-xs text-neutral-500">Cargada {formatearFechaHora(f.fecha)}</span></div></div>}</div>; })}{facturas.length === 0 && <div className="p-8 text-center text-neutral-500">Todavía no hay facturas.</div>}</div>}</Card>;
}
