"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import Card from "@/components/ui/Card";
import Button from "@/components/ui/Button";
import Badge from "@/components/ui/Badge";
import Plegable from "@/components/ui/Plegable";
import { input, label, td, th, trHover } from "@/components/ui/styles";
import { formatearMoneda } from "@/lib/formato";

type Categoria = { id: number; nombre: string; activo: boolean };
type Promo = {
  id: number; nombre: string; codigoBarras: string | null; categoriaId: number | null;
  precioCosto: number; precioVenta: number; precioVentaMesa: number; stock: number; unidad: string;
  impresora: string | null; requiereConfirmacion: boolean; activo: boolean;
  promoDesde: string; promoHasta: string; categoria: { id: number; nombre: string } | null;
};

const hoy = () => new Date().toISOString().slice(0, 10);
const enUnMes = () => { const d = new Date(); d.setMonth(d.getMonth() + 1); return d.toISOString().slice(0, 10); };
const vacio = { nombre: "", codigoBarras: "", categoriaId: "", precioCosto: "", precioVenta: "", precioVentaMesa: "", stock: "", unidad: "unidad", impresora: "", requiereConfirmacion: false, activo: true, promoDesde: hoy(), promoHasta: enUnMes() };
type FormPromo = typeof vacio;

function fechaInput(valor: string) { return new Date(valor).toISOString().slice(0, 10); }
function fechaServidor(valor: string, fin = false) { return new Date(`${valor}T${fin ? "23:59:59.999" : "00:00:00"}`).toISOString(); }

export default function PromosPage() {
  const [promos, setPromos] = useState<Promo[]>([]);
  const [categorias, setCategorias] = useState<Categoria[]>([]);
  const [form, setForm] = useState<FormPromo>(vacio);
  const [editandoId, setEditandoId] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [ahora] = useState(() => Date.now());

  async function cargar() {
    setLoading(true);
    const [p, c] = await Promise.all([fetch("/api/promos"), fetch("/api/categorias")]);
    setPromos(p.ok ? await p.json() : []); setCategorias(c.ok ? await c.json() : []); setLoading(false);
  }
  // eslint-disable-next-line react-hooks/set-state-in-effect -- carga inicial desde la API
  useEffect(() => { void cargar(); }, []);

  const payload = useMemo(() => ({ ...form, promoDesde: fechaServidor(form.promoDesde), promoHasta: fechaServidor(form.promoHasta, true) }), [form]);

  async function guardar(e: FormEvent) {
    e.preventDefault(); setError("");
    const res = await fetch(editandoId ? `/api/promos/${editandoId}` : "/api/promos", {
      method: editandoId ? "PUT" : "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload),
    });
    if (!res.ok) { const data = await res.json(); setError(data.error || "No se pudo guardar"); return; }
    setForm({ ...vacio, promoDesde: hoy(), promoHasta: enUnMes() }); setEditandoId(null); await cargar();
  }

  function editar(p: Promo) {
    setEditandoId(p.id); setError("");
    setForm({ nombre: p.nombre, codigoBarras: p.codigoBarras || "", categoriaId: p.categoriaId ? String(p.categoriaId) : "", precioCosto: String(p.precioCosto), precioVenta: String(p.precioVenta), precioVentaMesa: String(p.precioVentaMesa), stock: String(p.stock), unidad: p.unidad, impresora: p.impresora || "", requiereConfirmacion: p.requiereConfirmacion, activo: p.activo, promoDesde: fechaInput(p.promoDesde), promoHasta: fechaInput(p.promoHasta) });
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  async function desactivar(id: number) {
    if (!confirm("¿Dar de baja esta promoción?")) return;
    await fetch(`/api/promos/${id}`, { method: "DELETE" }); await cargar();
  }

  function estado(p: Promo) {
    if (!p.activo) return { texto: "Inactiva", variante: "neutral" as const };
    if (ahora < new Date(p.promoDesde).getTime()) return { texto: "Próxima", variante: "neutral" as const };
    if (ahora > new Date(p.promoHasta).getTime()) return { texto: "Finalizada", variante: "danger" as const };
    return { texto: "Vigente", variante: "success" as const };
  }

  return <div className="max-w-7xl mx-auto flex flex-col gap-6">
    <div><h1 className="text-2xl font-semibold text-neutral-900 dark:text-neutral-50">Promos</h1><p className="text-sm text-neutral-500 mt-1">Durante su vigencia aparecen automáticamente en ventas y mesas como cualquier producto.</p></div>
    <Plegable titulo={editandoId ? "Editar promoción" : "Agregar promoción"} abierto={editandoId ? true : undefined}>
      <form onSubmit={guardar} className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <div className="col-span-2"><label className={label}>Nombre *</label><input className={input} required value={form.nombre} onChange={e => setForm({...form, nombre:e.target.value})}/></div>
        <div><label className={label}>Desde *</label><input type="date" className={input} required value={form.promoDesde} onChange={e => setForm({...form,promoDesde:e.target.value})}/></div>
        <div><label className={label}>Hasta *</label><input type="date" className={input} required min={form.promoDesde} value={form.promoHasta} onChange={e => setForm({...form,promoHasta:e.target.value})}/></div>
        <div><label className={label}>Código de barras</label><input className={input} value={form.codigoBarras} onChange={e=>setForm({...form,codigoBarras:e.target.value})}/></div>
        <div><label className={label}>Categoría</label><select className={input} value={form.categoriaId} onChange={e=>setForm({...form,categoriaId:e.target.value})}><option value="">-</option>{categorias.filter(c=>c.activo).map(c=><option key={c.id} value={c.id}>{c.nombre}</option>)}</select></div>
        <div><label className={label}>Costo</label><input type="number" min="0" step="0.01" className={input} value={form.precioCosto} onChange={e=>setForm({...form,precioCosto:e.target.value})}/></div>
        <div><label className={label}>Precio venta *</label><input type="number" min="0" step="0.01" required className={input} value={form.precioVenta} onChange={e=>setForm({...form,precioVenta:e.target.value})}/></div>
        <div><label className={label}>Precio mesa</label><input type="number" min="0" step="0.01" className={input} value={form.precioVentaMesa} onChange={e=>setForm({...form,precioVentaMesa:e.target.value})}/></div>
        <div><label className={label}>Stock</label><input type="number" step="0.01" className={input} value={form.stock} onChange={e=>setForm({...form,stock:e.target.value})}/></div>
        <div><label className={label}>Unidad</label><input className={input} value={form.unidad} onChange={e=>setForm({...form,unidad:e.target.value})}/></div>
        <div><label className={label}>Impresora de comanda</label><input className={input} placeholder="Predeterminada" value={form.impresora} onChange={e=>setForm({...form,impresora:e.target.value})}/></div>
        <label className="flex items-center gap-2 text-sm self-end pb-2"><input type="checkbox" checked={form.requiereConfirmacion} onChange={e=>setForm({...form,requiereConfirmacion:e.target.checked})}/> Es comida</label>
        {editandoId && <label className="flex items-center gap-2 text-sm self-end pb-2"><input type="checkbox" checked={form.activo} onChange={e=>setForm({...form,activo:e.target.checked})}/> Activa</label>}
        <div className="col-span-2 md:col-span-4 flex gap-2 items-center"><Button type="submit" variant="primary">{editandoId ? "Guardar cambios" : "Crear promoción"}</Button>{editandoId && <Button type="button" onClick={()=>{setEditandoId(null);setForm({...vacio,promoDesde:hoy(),promoHasta:enUnMes()})}}>Cancelar</Button>}{error&&<span className="text-sm text-red-500">{error}</span>}</div>
      </form>
    </Plegable>
    <Card>{loading?<div className="p-4 text-sm text-neutral-500">Cargando...</div>:promos.length===0?<div className="p-4 text-sm text-neutral-500">Todavía no hay promociones</div>:<div className="overflow-auto"><table className="w-full"><thead><tr><th className={th}>Promoción</th><th className={th}>Vigencia</th><th className={th}>Estado</th><th className={th}>Precio</th><th className={th}>Mesa</th><th className={th}>Stock</th><th className={th}></th></tr></thead><tbody>{promos.map(p=>{const e=estado(p);return <tr key={p.id} className={trHover}><td className={td}><div className="font-medium">{p.nombre}</div><div className="text-xs text-neutral-500">{p.categoria?.nombre||"Sin categoría"}</div></td><td className={td}>{fechaInput(p.promoDesde)} → {fechaInput(p.promoHasta)}</td><td className={td}><Badge variant={e.variante}>{e.texto}</Badge></td><td className={td}>${formatearMoneda(p.precioVenta)}</td><td className={td}>${formatearMoneda(p.precioVentaMesa)}</td><td className={td}>{p.stock} {p.unidad}</td><td className={`${td} text-right whitespace-nowrap`}><button onClick={()=>editar(p)} className="text-blue-500 mr-3">Editar</button>{p.activo&&<button onClick={()=>desactivar(p.id)} className="text-red-500">Dar de baja</button>}</td></tr>})}</tbody></table></div>}</Card>
  </div>;
}
