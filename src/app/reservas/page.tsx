"use client";

import { useEffect, useState, FormEvent } from "react";
import Card from "@/components/ui/Card";
import Button from "@/components/ui/Button";
import Badge from "@/components/ui/Badge";
import { input, label, th, td, trHover } from "@/components/ui/styles";

type Mesa = { id: number; nombre: string };

type Reserva = {
  id: number;
  nombre: string;
  telefono: string | null;
  personas: number;
  fecha: string;
  notas: string | null;
  estado: "PENDIENTE" | "CUMPLIDA" | "CANCELADA";
  mesaId: number | null;
  mesa: Mesa | null;
};

const emptyForm = {
  nombre: "",
  telefono: "",
  personas: "2",
  fecha: "",
  mesaId: "",
  notas: "",
};

function aDatetimeLocal(d: Date) {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export default function ReservasPage() {
  const [reservas, setReservas] = useState<Reserva[]>([]);
  const [mesas, setMesas] = useState<Mesa[]>([]);
  const [form, setForm] = useState(() => ({ ...emptyForm, fecha: aDatetimeLocal(new Date()) }));
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [mostrarTodas, setMostrarTodas] = useState(false);

  async function cargar() {
    setLoading(true);
    const [resRes, mesasRes] = await Promise.all([fetch("/api/reservas"), fetch("/api/mesas")]);
    setReservas(await resRes.json());
    setMesas(await mesasRes.json());
    setLoading(false);
  }

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- carga inicial de datos al montar la página
    cargar();
  }, []);

  async function guardar(e: FormEvent) {
    e.preventDefault();
    setError("");

    const res = await fetch("/api/reservas", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        nombre: form.nombre,
        telefono: form.telefono || null,
        personas: form.personas,
        fecha: new Date(form.fecha).toISOString(),
        mesaId: form.mesaId || null,
        notas: form.notas,
      }),
    });

    if (!res.ok) {
      const data = await res.json();
      setError(data.error || "Ocurrió un error");
      return;
    }

    setForm({ ...emptyForm, fecha: aDatetimeLocal(new Date()) });
    await cargar();
  }

  async function cambiarEstado(id: number, estado: "CUMPLIDA" | "CANCELADA") {
    await fetch(`/api/reservas/${id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ estado }),
    });
    await cargar();
  }

  const listado = reservas.filter((r) => mostrarTodas || r.estado === "PENDIENTE");

  return (
    <div className="max-w-5xl mx-auto flex flex-col gap-6">
      <h1 className="text-2xl font-semibold tracking-tight text-neutral-900 dark:text-neutral-50">Reservas</h1>

      <Card className="p-4">
        <form onSubmit={guardar} className="grid grid-cols-2 md:grid-cols-4 gap-3">
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
            <label className={label}>Teléfono</label>
            <input
              className={input}
              value={form.telefono}
              onChange={(e) => setForm({ ...form, telefono: e.target.value })}
            />
          </div>
          <div>
            <label className={label}>Personas *</label>
            <input
              type="number"
              min="1"
              className={input}
              value={form.personas}
              onChange={(e) => setForm({ ...form, personas: e.target.value })}
              required
            />
          </div>
          <div>
            <label className={label}>Fecha y hora *</label>
            <input
              type="datetime-local"
              className={input}
              value={form.fecha}
              onChange={(e) => setForm({ ...form, fecha: e.target.value })}
              required
            />
          </div>
          <div>
            <label className={label}>Mesa (opcional)</label>
            <select className={input} value={form.mesaId} onChange={(e) => setForm({ ...form, mesaId: e.target.value })}>
              <option value="">-</option>
              {mesas.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.nombre}
                </option>
              ))}
            </select>
          </div>
          <div className="col-span-2">
            <label className={label}>Notas</label>
            <input
              className={input}
              value={form.notas}
              onChange={(e) => setForm({ ...form, notas: e.target.value })}
              placeholder="Cumpleaños, alergias, etc."
            />
          </div>

          <div className="col-span-2 md:col-span-4 flex items-center gap-3 pt-1">
            <Button type="submit" variant="primary">
              Agregar reserva
            </Button>
            {error && <span className="text-sm text-red-400">{error}</span>}
          </div>
        </form>
      </Card>

      <Card>
        <div className="flex items-center justify-between p-3 border-b border-neutral-200 dark:border-neutral-800">
          <span className="text-sm text-neutral-500 dark:text-neutral-400">{listado.length} reserva(s)</span>
          <label className="flex items-center gap-2 text-sm text-neutral-500 dark:text-neutral-400">
            <input type="checkbox" checked={mostrarTodas} onChange={(e) => setMostrarTodas(e.target.checked)} />
            Mostrar todas (incluye cumplidas y canceladas)
          </label>
        </div>
        {loading ? (
          <div className="p-4 text-sm text-neutral-500">Cargando...</div>
        ) : listado.length === 0 ? (
          <div className="p-4 text-sm text-neutral-500">No hay reservas pendientes</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr>
                  <th className={th}>Fecha</th>
                  <th className={th}>Nombre</th>
                  <th className={th}>Personas</th>
                  <th className={th}>Mesa</th>
                  <th className={th}>Estado</th>
                  <th className={th}></th>
                </tr>
              </thead>
              <tbody>
                {listado.map((r) => (
                  <tr key={r.id} className={trHover}>
                    <td className={td}>{new Date(r.fecha).toLocaleString("es-AR")}</td>
                    <td className={td}>
                      {r.nombre}
                      {r.telefono && <span className="text-neutral-500"> · {r.telefono}</span>}
                    </td>
                    <td className={td}>{r.personas}</td>
                    <td className={td}>{r.mesa?.nombre || "-"}</td>
                    <td className={td}>
                      {r.estado === "PENDIENTE" && <Badge variant="warning">Pendiente</Badge>}
                      {r.estado === "CUMPLIDA" && <Badge variant="success">Cumplida</Badge>}
                      {r.estado === "CANCELADA" && <Badge variant="neutral">Cancelada</Badge>}
                    </td>
                    <td className={`${td} text-right whitespace-nowrap`}>
                      <a
                        href={`/reservas/${r.id}/ticket`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-blue-500 hover:text-blue-400 mr-3"
                      >
                        Imprimir
                      </a>
                      {r.estado === "PENDIENTE" && (
                        <>
                          <button
                            className="text-emerald-400 hover:text-emerald-300 mr-3"
                            onClick={() => cambiarEstado(r.id, "CUMPLIDA")}
                          >
                            Cumplida
                          </button>
                          <button
                            className="text-red-400 hover:text-red-300"
                            onClick={() => cambiarEstado(r.id, "CANCELADA")}
                          >
                            Cancelar
                          </button>
                        </>
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
