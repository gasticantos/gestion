"use client";

import { useEffect, useState, FormEvent } from "react";
import Card from "@/components/ui/Card";
import Button from "@/components/ui/Button";
import Badge from "@/components/ui/Badge";
import { input, label, th, td, trHover } from "@/components/ui/styles";

type Proveedor = {
  id: number;
  nombre: string;
  telefono: string | null;
  contacto: string | null;
  notas: string | null;
  activo: boolean;
};

const emptyForm = {
  id: null as number | null,
  nombre: "",
  telefono: "",
  contacto: "",
  notas: "",
};

export default function ProveedoresPage() {
  const [proveedores, setProveedores] = useState<Proveedor[]>([]);
  const [form, setForm] = useState(emptyForm);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [mostrarInactivos, setMostrarInactivos] = useState(false);

  async function cargar() {
    setLoading(true);
    const res = await fetch("/api/proveedores");
    setProveedores(await res.json());
    setLoading(false);
  }

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- carga inicial de datos al montar la página
    cargar();
  }, []);

  function editar(p: Proveedor) {
    setForm({
      id: p.id,
      nombre: p.nombre,
      telefono: p.telefono || "",
      contacto: p.contacto || "",
      notas: p.notas || "",
    });
  }

  async function guardar(e: FormEvent) {
    e.preventDefault();
    setError("");

    const res = await fetch(form.id ? `/api/proveedores/${form.id}` : "/api/proveedores", {
      method: form.id ? "PUT" : "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(form),
    });

    if (!res.ok) {
      const data = await res.json();
      setError(data.error || "Ocurrió un error");
      return;
    }

    setForm(emptyForm);
    await cargar();
  }

  async function darDeBaja(id: number) {
    if (!confirm("¿Dar de baja este proveedor?")) return;
    await fetch(`/api/proveedores/${id}`, { method: "DELETE" });
    await cargar();
  }

  const listado = proveedores.filter((p) => mostrarInactivos || p.activo);

  return (
    <div className="max-w-4xl mx-auto flex flex-col gap-6">
      <h1 className="text-2xl font-semibold tracking-tight text-neutral-50">Proveedores</h1>

      <Card className="p-4">
        <form onSubmit={guardar} className="grid grid-cols-2 gap-3">
          <div>
            <label className={label}>Nombre *</label>
            <input
              className={input}
              value={form.nombre}
              onChange={(e) => setForm({ ...form, nombre: e.target.value })}
              required
            />
          </div>
          <div>
            <label className={label}>Teléfono</label>
            <input
              className={input}
              value={form.telefono}
              onChange={(e) => setForm({ ...form, telefono: e.target.value })}
            />
          </div>
          <div>
            <label className={label}>Contacto</label>
            <input
              className={input}
              value={form.contacto}
              onChange={(e) => setForm({ ...form, contacto: e.target.value })}
            />
          </div>
          <div>
            <label className={label}>Notas</label>
            <input
              className={input}
              value={form.notas}
              onChange={(e) => setForm({ ...form, notas: e.target.value })}
            />
          </div>

          <div className="col-span-2 flex items-center gap-3 pt-1">
            <Button type="submit" variant="primary">
              {form.id ? "Guardar cambios" : "Agregar proveedor"}
            </Button>
            {form.id && (
              <Button type="button" variant="ghost" onClick={() => setForm(emptyForm)}>
                Cancelar edición
              </Button>
            )}
            {error && <span className="text-sm text-red-400">{error}</span>}
          </div>
        </form>
      </Card>

      <Card>
        <div className="flex items-center justify-between p-3 border-b border-neutral-800">
          <span className="text-sm text-neutral-400">{listado.length} proveedor(es)</span>
          <label className="flex items-center gap-2 text-sm text-neutral-400">
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
                  <th className={th}>Contacto</th>
                  <th className={th}>Notas</th>
                  <th className={th}></th>
                </tr>
              </thead>
              <tbody>
                {listado.map((p) => (
                  <tr key={p.id} className={`${trHover} ${!p.activo ? "opacity-40" : ""}`}>
                    <td className={td}>{p.nombre}</td>
                    <td className={td}>{p.telefono || "-"}</td>
                    <td className={td}>{p.contacto || "-"}</td>
                    <td className={td}>{p.notas || "-"}</td>
                    <td className={`${td} text-right whitespace-nowrap`}>
                      <button className="text-blue-500 hover:text-blue-400 mr-3" onClick={() => editar(p)}>
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
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </div>
  );
}
