"use client";

import { useEffect, useState, FormEvent } from "react";
import Link from "next/link";
import Card from "@/components/ui/Card";
import Button from "@/components/ui/Button";
import Badge from "@/components/ui/Badge";
import { input, label, th, td, trHover } from "@/components/ui/styles";
import { formatearMoneda } from "@/lib/formato";

type Cliente = {
  id: number;
  nombre: string;
  telefono: string | null;
  saldo: number;
  activo: boolean;
};

export default function ClientesPage() {
  const [clientes, setClientes] = useState<Cliente[]>([]);
  const [nombre, setNombre] = useState("");
  const [telefono, setTelefono] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [mostrarInactivos, setMostrarInactivos] = useState(false);
  const [editandoId, setEditandoId] = useState<number | null>(null);
  const [editNombre, setEditNombre] = useState("");
  const [editTelefono, setEditTelefono] = useState("");

  async function cargar() {
    setLoading(true);
    const res = await fetch("/api/clientes");
    setClientes(await res.json());
    setLoading(false);
  }

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- carga inicial de datos al montar la página
    cargar();
  }, []);

  async function agregar(e: FormEvent) {
    e.preventDefault();
    setError("");
    const res = await fetch("/api/clientes", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ nombre, telefono }),
    });
    if (!res.ok) {
      const data = await res.json();
      setError(data.error || "Ocurrió un error");
      return;
    }
    setNombre("");
    setTelefono("");
    await cargar();
  }

  function iniciarEdicion(c: Cliente) {
    setEditandoId(c.id);
    setEditNombre(c.nombre);
    setEditTelefono(c.telefono || "");
  }

  function cancelarEdicion() {
    setEditandoId(null);
    setEditNombre("");
    setEditTelefono("");
  }

  async function guardarEdicion(clienteId: number) {
    setError("");
    if (!editNombre.trim()) {
      setError("El nombre es obligatorio");
      return;
    }
    const res = await fetch(`/api/clientes/${clienteId}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ nombre: editNombre, telefono: editTelefono || null }),
    });
    if (!res.ok) {
      const data = await res.json();
      setError(data.error || "Ocurrió un error");
      return;
    }
    cancelarEdicion();
    await cargar();
  }

  async function eliminarCliente(clienteId: number) {
    if (!confirm("¿Eliminar este cliente? Se marcará como inactivo.")) return;
    setError("");
    const res = await fetch(`/api/clientes/${clienteId}`, { method: "DELETE" });
    if (!res.ok) {
      const data = await res.json();
      setError(data.error || "Ocurrió un error");
      return;
    }
    await cargar();
  }

  const listado = clientes.filter((c) => mostrarInactivos || c.activo);

  return (
    <div className="max-w-3xl mx-auto flex flex-col gap-6">
      <h1 className="text-2xl font-semibold tracking-tight text-neutral-900 dark:text-neutral-50">Clientes (cuenta corriente)</h1>

      <Card className="p-4">
        <form onSubmit={agregar} className="flex items-end gap-3">
          <div className="flex-1">
            <label className={label}>Nombre *</label>
            <input className={input} value={nombre} onChange={(e) => setNombre(e.target.value)} required />
          </div>
          <div className="flex-1">
            <label className={label}>Teléfono</label>
            <input className={input} value={telefono} onChange={(e) => setTelefono(e.target.value)} />
          </div>
          <Button type="submit" variant="primary">
            Agregar cliente
          </Button>
          {error && <span className="text-sm text-red-400">{error}</span>}
        </form>
      </Card>

      <Card>
        <div className="flex items-center justify-between p-3 border-b border-neutral-200 dark:border-neutral-800">
          <span className="text-sm text-neutral-500 dark:text-neutral-400">{listado.length} cliente(s)</span>
          <label className="flex items-center gap-2 text-sm text-neutral-500 dark:text-neutral-400">
            <input
              type="checkbox"
              checked={mostrarInactivos}
              onChange={(e) => setMostrarInactivos(e.target.checked)}
            />
            Mostrar dados de baja
          </label>
        </div>
        {loading ? (
          <div className="p-4 text-sm text-neutral-500">Cargando...</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr>
                  <th className={th}>Nombre</th>
                  <th className={th}>Teléfono</th>
                  <th className={th}>Estado</th>
                  <th className={th}>Saldo</th>
                  <th className={th}></th>
                </tr>
              </thead>
              <tbody>
                {listado.map((c) =>
                  editandoId === c.id ? (
                    <tr key={c.id} className={trHover}>
                      <td className={td}>
                        <input
                          className={input}
                          value={editNombre}
                          onChange={(e) => setEditNombre(e.target.value)}
                          autoFocus
                        />
                      </td>
                      <td className={td}>
                        <input className={input} value={editTelefono} onChange={(e) => setEditTelefono(e.target.value)} />
                      </td>
                      <td colSpan={3} className={`${td} text-right whitespace-nowrap gap-2`}>
                        <button
                          className="text-blue-500 hover:text-blue-400 mr-3"
                          onClick={() => guardarEdicion(c.id)}
                        >
                          Guardar
                        </button>
                        <button className="text-neutral-500 dark:text-neutral-400 hover:text-neutral-700 dark:hover:text-neutral-200" onClick={cancelarEdicion}>
                          Cancelar
                        </button>
                      </td>
                    </tr>
                  ) : (
                    <tr key={c.id} className={`${trHover} ${!c.activo ? "opacity-40" : ""}`}>
                      <td className={td}>{c.nombre}</td>
                      <td className={td}>{c.telefono || "-"}</td>
                      <td className={td}>
                        {c.saldo > 0 ? (
                          <Badge variant="danger">DEBE</Badge>
                        ) : (
                          <Badge variant="success">Al día</Badge>
                        )}
                      </td>
                      <td className={`${td} font-medium ${c.saldo > 0 ? "text-red-400" : ""}`}>
                        ${formatearMoneda(c.saldo)}
                      </td>
                      <td className={`${td} text-right whitespace-nowrap`}>
                        <Link href={`/clientes/${c.id}`} className="text-blue-500 hover:text-blue-400 mr-3">
                          Ver cuenta
                        </Link>
                        <button
                          className="text-amber-500 hover:text-amber-400 mr-3"
                          onClick={() => iniciarEdicion(c)}
                        >
                          Editar
                        </button>
                        <button
                          className="text-red-400 hover:text-red-300"
                          onClick={() => eliminarCliente(c.id)}
                        >
                          Eliminar
                        </button>
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
