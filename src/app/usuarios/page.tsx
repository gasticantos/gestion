"use client";

import { useEffect, useState, FormEvent } from "react";
import Card from "@/components/ui/Card";
import Button from "@/components/ui/Button";
import Badge from "@/components/ui/Badge";
import { input, label, th, td, trHover } from "@/components/ui/styles";
import { ROL_LABEL } from "@/lib/permisos";
import { Rol } from "@/generated/prisma/enums";

type Usuario = {
  id: number;
  nombre: string;
  email: string;
  rol: Rol;
  activo: boolean;
};

const emptyForm = {
  id: null as number | null,
  nombre: "",
  email: "",
  password: "",
  rol: "MOZO" as Rol,
};

export default function UsuariosPage() {
  const [usuarios, setUsuarios] = useState<Usuario[]>([]);
  const [form, setForm] = useState(emptyForm);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [mostrarInactivos, setMostrarInactivos] = useState(false);

  async function cargar() {
    setLoading(true);
    const res = await fetch("/api/usuarios");
    setUsuarios(await res.json());
    setLoading(false);
  }

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- carga inicial de datos al montar la página
    cargar();
  }, []);

  function editar(u: Usuario) {
    setForm({ id: u.id, nombre: u.nombre, email: u.email, password: "", rol: u.rol });
  }

  async function guardar(e: FormEvent) {
    e.preventDefault();
    setError("");

    const payload: Record<string, unknown> = {
      nombre: form.nombre,
      email: form.email,
      rol: form.rol,
    };
    if (form.password) payload.password = form.password;
    if (!form.id && !form.password) {
      setError("La contraseña es obligatoria para un usuario nuevo");
      return;
    }

    const res = await fetch(form.id ? `/api/usuarios/${form.id}` : "/api/usuarios", {
      method: form.id ? "PUT" : "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
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
    if (!confirm("¿Dar de baja este usuario? No va a poder iniciar sesión.")) return;
    await fetch(`/api/usuarios/${id}`, { method: "DELETE" });
    await cargar();
  }

  const listado = usuarios.filter((u) => mostrarInactivos || u.activo);

  return (
    <div className="max-w-3xl mx-auto flex flex-col gap-6">
      <h1 className="text-2xl font-semibold tracking-tight text-neutral-900 dark:text-neutral-50">Usuarios</h1>

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
            <label className={label}>Email *</label>
            <input
              type="email"
              className={input}
              value={form.email}
              onChange={(e) => setForm({ ...form, email: e.target.value })}
              required
            />
          </div>
          <div>
            <label className={label}>{form.id ? "Nueva contraseña (opcional)" : "Contraseña *"}</label>
            <input
              type="password"
              className={input}
              value={form.password}
              onChange={(e) => setForm({ ...form, password: e.target.value })}
              minLength={6}
              placeholder={form.id ? "Dejar en blanco para no cambiarla" : undefined}
            />
          </div>
          <div>
            <label className={label}>Rol</label>
            <select className={input} value={form.rol} onChange={(e) => setForm({ ...form, rol: e.target.value as Rol })}>
              <option value="DUENIO">Dueño</option>
              <option value="CAJERO">Cajero</option>
              <option value="MOZO">Moza/o</option>
            </select>
          </div>

          <div className="col-span-2 flex items-center gap-3 pt-1">
            <Button type="submit" variant="primary">
              {form.id ? "Guardar cambios" : "Crear usuario"}
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
        <div className="flex items-center justify-between p-3 border-b border-neutral-200 dark:border-neutral-800">
          <span className="text-sm text-neutral-500 dark:text-neutral-400">{listado.length} usuario(s)</span>
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
          <table className="w-full">
            <thead>
              <tr>
                <th className={th}>Nombre</th>
                <th className={th}>Email</th>
                <th className={th}>Rol</th>
                <th className={th}></th>
              </tr>
            </thead>
            <tbody>
              {listado.map((u) => (
                <tr key={u.id} className={`${trHover} ${!u.activo ? "opacity-40" : ""}`}>
                  <td className={td}>{u.nombre}</td>
                  <td className={td}>{u.email}</td>
                  <td className={td}>
                    <Badge variant={u.rol === "DUENIO" ? "accent" : "neutral"}>{ROL_LABEL[u.rol]}</Badge>
                  </td>
                  <td className={`${td} text-right whitespace-nowrap`}>
                    <button className="text-blue-500 hover:text-blue-400 mr-3" onClick={() => editar(u)}>
                      Editar
                    </button>
                    {u.activo && (
                      <button className="text-red-400 hover:text-red-300" onClick={() => darDeBaja(u.id)}>
                        Dar de baja
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Card>
    </div>
  );
}
