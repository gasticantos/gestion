"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import BuscadorProducto, { ProductoBusqueda } from "@/components/BuscadorProducto";
import Card from "@/components/ui/Card";
import Button from "@/components/ui/Button";
import Badge from "@/components/ui/Badge";
import Plegable from "@/components/ui/Plegable";
import { input, label, td, th, trHover } from "@/components/ui/styles";
import { aplicarDescuento } from "@/lib/precio";
import { formatearFechaHora, formatearMoneda } from "@/lib/formato";

type Item = { productoId?: number; nombre: string; cantidad: number; precioUnitario: number };
type Presupuesto = { id:number; clienteNombre:string; clienteTelefono:string|null; validoHasta:string; descuentoPct:number; subtotal:number; total:number; notas:string|null; estado:"BORRADOR"|"ACEPTADO"|"VENCIDO"|"CANCELADO"; createdAt:string; items:(Item&{id:number;subtotal:number})[] };
type Cliente = { id:number; nombre:string; telefono?:string|null };

const fechaValidez = () => { const d=new Date(); d.setDate(d.getDate()+15); return d.toISOString().slice(0,10); };
const etiquetas = { BORRADOR:"Pendiente", ACEPTADO:"Aceptado", VENCIDO:"Vencido", CANCELADO:"Cancelado" };

export default function PresupuestosPage() {
  const [presupuestos,setPresupuestos]=useState<Presupuesto[]>([]);
  const [clientes,setClientes]=useState<Cliente[]>([]);
  const [items,setItems]=useState<Item[]>([]);
  const [clienteNombre,setClienteNombre]=useState(""); const [clienteTelefono,setClienteTelefono]=useState("");
  const [validoHasta,setValidoHasta]=useState(fechaValidez()); const [descuentoPct,setDescuentoPct]=useState("0"); const [notas,setNotas]=useState("");
  const [concepto,setConcepto]=useState(""); const [precioConcepto,setPrecioConcepto]=useState("");
  const [error,setError]=useState(""); const [guardando,setGuardando]=useState(false); const [detalle,setDetalle]=useState<number|null>(null);

  async function cargar(){const [p,c]=await Promise.all([fetch("/api/presupuestos"),fetch("/api/clientes")]);setPresupuestos(p.ok?await p.json():[]);setClientes(c.ok?await c.json():[]);}
  // eslint-disable-next-line react-hooks/set-state-in-effect -- carga inicial desde la API
  useEffect(()=>{void cargar();},[]);

  const subtotal=useMemo(()=>items.reduce((s,i)=>s+i.cantidad*i.precioUnitario,0),[items]);
  const total=useMemo(()=>aplicarDescuento(subtotal,Number(descuentoPct)||0),[subtotal,descuentoPct]);

  function agregarProducto(p:ProductoBusqueda,_tarifa:unknown,precio:number,cantidad=1){setItems(actual=>{const existe=actual.find(i=>i.productoId===p.id);return existe?actual.map(i=>i===existe?{...i,cantidad:i.cantidad+cantidad}:i):[...actual,{productoId:p.id,nombre:p.nombre,cantidad,precioUnitario:precio}]})}
  function agregarConcepto(){if(!concepto.trim())return;setItems(a=>[...a,{nombre:concepto.trim(),cantidad:1,precioUnitario:Number(precioConcepto)||0}]);setConcepto("");setPrecioConcepto("");}
  function cambiarItem(index:number,cambios:Partial<Item>){setItems(a=>a.map((i,n)=>n===index?{...i,...cambios}:i));}

  async function guardar(e:FormEvent){e.preventDefault();setError("");setGuardando(true);const res=await fetch("/api/presupuestos",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({clienteNombre,clienteTelefono,validoHasta:new Date(`${validoHasta}T23:59:59`).toISOString(),descuentoPct,notas,items})});setGuardando(false);if(!res.ok){const d=await res.json();setError(d.error||"No se pudo guardar");return}setItems([]);setClienteNombre("");setClienteTelefono("");setValidoHasta(fechaValidez());setDescuentoPct("0");setNotas("");await cargar();}
  async function cambiarEstado(id:number,estado:"BORRADOR"|"ACEPTADO"|"CANCELADO"){await fetch(`/api/presupuestos/${id}`,{method:"PATCH",headers:{"Content-Type":"application/json"},body:JSON.stringify({estado})});await cargar();}
  async function eliminar(id:number){if(!confirm("¿Eliminar definitivamente este presupuesto?"))return;await fetch(`/api/presupuestos/${id}`,{method:"DELETE"});await cargar();}
  function variant(e:Presupuesto["estado"]){return e==="ACEPTADO"?"success" as const:e==="BORRADOR"?"accent" as const:e==="VENCIDO"?"warning" as const:"danger" as const;}

  return <div className="max-w-7xl mx-auto flex flex-col gap-6">
    <div><h1 className="text-2xl font-semibold text-neutral-900 dark:text-neutral-50">Presupuestos</h1><p className="text-sm text-neutral-500 mt-1">Cotizaciones con precios congelados, fecha de validez y seguimiento.</p></div>
    <Plegable titulo="Nuevo presupuesto">
      <form onSubmit={guardar} className="flex flex-col gap-4">
        <div className="grid sm:grid-cols-3 gap-3">
          <div><label className={label}>Cliente *</label><input list="clientes-presupuesto" required className={input} value={clienteNombre} onChange={e=>{setClienteNombre(e.target.value);const c=clientes.find(c=>c.nombre===e.target.value);if(c?.telefono)setClienteTelefono(c.telefono)}}/><datalist id="clientes-presupuesto">{clientes.map(c=><option key={c.id} value={c.nombre}/>)}</datalist></div>
          <div><label className={label}>Teléfono</label><input className={input} value={clienteTelefono} onChange={e=>setClienteTelefono(e.target.value)}/></div>
          <div><label className={label}>Válido hasta *</label><input type="date" required className={input} min={new Date().toISOString().slice(0,10)} value={validoHasta} onChange={e=>setValidoHasta(e.target.value)}/></div>
        </div>
        <div className="grid md:grid-cols-2 gap-4">
          <div><label className={label}>Agregar producto</label><BuscadorProducto onSeleccionar={agregarProducto} elegirPrecio={false}/></div>
          <div><label className={label}>Agregar concepto libre</label><div className="flex gap-2"><input className={input} placeholder="Descripción" value={concepto} onChange={e=>setConcepto(e.target.value)}/><input type="number" min="0" step="0.01" className={`${input} max-w-32`} placeholder="Precio" value={precioConcepto} onChange={e=>setPrecioConcepto(e.target.value)}/><Button type="button" onClick={agregarConcepto}>Agregar</Button></div></div>
        </div>
        {items.length===0?<div className="rounded-lg border border-dashed border-neutral-300 dark:border-neutral-700 p-4 text-sm text-neutral-500">Agregá productos o conceptos al presupuesto.</div>:<Card className="overflow-auto"><table className="w-full"><thead><tr><th className={th}>Descripción</th><th className={th}>Cantidad</th><th className={th}>Precio unit.</th><th className={th}>Subtotal</th><th className={th}></th></tr></thead><tbody>{items.map((i,n)=><tr key={`${i.productoId||"libre"}-${n}`} className={trHover}><td className={td}><input className={input} value={i.nombre} onChange={e=>cambiarItem(n,{nombre:e.target.value})}/></td><td className={td}><input type="number" min="0.01" step="0.01" className={`${input} w-24`} value={i.cantidad} onChange={e=>cambiarItem(n,{cantidad:Number(e.target.value)||0})}/></td><td className={td}><input type="number" min="0" step="0.01" className={`${input} w-32`} value={i.precioUnitario} onChange={e=>cambiarItem(n,{precioUnitario:Number(e.target.value)||0})}/></td><td className={td}>${formatearMoneda(i.cantidad*i.precioUnitario)}</td><td className={td}><button type="button" className="text-red-500" onClick={()=>setItems(a=>a.filter((_,x)=>x!==n))}>Quitar</button></td></tr>)}</tbody></table></Card>}
        <div className="grid md:grid-cols-[1fr_280px] gap-4"><div><label className={label}>Notas / condiciones</label><textarea className={`${input} min-h-24`} value={notas} onChange={e=>setNotas(e.target.value)} placeholder="Forma de entrega, condiciones de pago, aclaraciones..."/></div><Card className="p-4 flex flex-col gap-2"><div className="flex justify-between text-sm"><span>Subtotal</span><span>${formatearMoneda(subtotal)}</span></div><label className="flex justify-between items-center text-sm"><span>Descuento</span><span className="flex items-center gap-1"><input type="number" min="0" max="100" step="0.1" className={`${input} w-20`} value={descuentoPct} onChange={e=>setDescuentoPct(e.target.value)}/>%</span></label><div className="flex justify-between text-xl font-semibold border-t pt-2 border-neutral-200 dark:border-neutral-700"><span>Total</span><span>${formatearMoneda(total.total)}</span></div></Card></div>
        <div className="flex gap-3 items-center"><Button type="submit" variant="primary" disabled={guardando||items.length===0}>{guardando?"Guardando...":"Guardar presupuesto"}</Button>{error&&<span className="text-sm text-red-500">{error}</span>}</div>
      </form>
    </Plegable>
    <Card><div className="p-3 border-b border-neutral-200 dark:border-neutral-800 font-medium">Historial</div>{presupuestos.length===0?<div className="p-4 text-sm text-neutral-500">Todavía no hay presupuestos.</div>:<div className="divide-y divide-neutral-200 dark:divide-neutral-800">{presupuestos.map(p=><div key={p.id} className="p-4"><div className="flex flex-wrap items-center gap-3"><button className="font-semibold text-left hover:text-blue-500" onClick={()=>setDetalle(detalle===p.id?null:p.id)}>#{p.id} · {p.clienteNombre}</button><Badge variant={variant(p.estado)}>{etiquetas[p.estado]}</Badge><span className="text-sm text-neutral-500">Emitido {formatearFechaHora(p.createdAt)}</span><span className="ml-auto text-lg font-semibold">${formatearMoneda(p.total)}</span></div><div className="mt-2 flex flex-wrap gap-3 text-xs"><button onClick={()=>setDetalle(detalle===p.id?null:p.id)} className="text-blue-500">{detalle===p.id?"Ocultar detalle":"Ver detalle"}</button>{p.estado!=="ACEPTADO"&&<button onClick={()=>cambiarEstado(p.id,"ACEPTADO")} className="text-emerald-500">Marcar aceptado</button>}{p.estado!=="CANCELADO"&&<button onClick={()=>cambiarEstado(p.id,"CANCELADO")} className="text-amber-500">Cancelar</button>}<button onClick={()=>eliminar(p.id)} className="text-red-500">Eliminar</button></div>{detalle===p.id&&<div className="mt-4 rounded-lg bg-neutral-50 dark:bg-neutral-950 p-4"><div className="grid sm:grid-cols-2 gap-1 text-sm mb-3"><div><b>Cliente:</b> {p.clienteNombre}</div><div><b>Teléfono:</b> {p.clienteTelefono||"—"}</div><div><b>Válido hasta:</b> {new Date(p.validoHasta).toLocaleDateString("es-AR")}</div><div><b>Descuento:</b> {p.descuentoPct}%</div></div>{p.items.map(i=><div key={i.id} className="flex justify-between text-sm border-t border-neutral-200 dark:border-neutral-800 py-2"><span>{i.cantidad} × {i.nombre}</span><span>${formatearMoneda(i.subtotal)}</span></div>)}{p.notas&&<p className="text-sm text-neutral-500 mt-3 whitespace-pre-wrap">{p.notas}</p>}<Button type="button" size="sm" className="mt-3 print:hidden" onClick={()=>window.print()}>Imprimir</Button></div>}</div>)}</div>}</Card>
  </div>;
}
