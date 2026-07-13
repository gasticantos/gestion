"use client";

import { useEffect, useState, use, FormEvent } from "react";
import Link from "next/link";
import Card from "@/components/ui/Card";
import Button from "@/components/ui/Button";
import Badge from "@/components/ui/Badge";
import { input, label, th, td, trHover } from "@/components/ui/styles";
import { formatearMoneda } from "@/lib/formato";

type Metodo = "EFECTIVO" | "TARJETA" | "TRANSFERENCIA";
type Tipo = "CARGO" | "PAGO" | "INTERES";

const METODOS: { value: Metodo; label: string }[] = [
  { value: "EFECTIVO", label: "Efectivo" },
  { value: "TARJETA", label: "Tarjeta" },
  { value: "TRANSFERENCIA", label: "Transferencia" },
];

const TIPOS: { value: Tipo; label: string }[] = [
  { value: "CARGO", label: "Cargo (consumo)" },
  { value: "PAGO", label: "Pago" },
  { value: "INTERES", label: "Interés" },
];

type Movimiento = {
  id: number;
  tipo: Tipo;
  monto: number;
  metodo: Metodo | null;
  ventaId: number | null;
  notas: string | null;
  createdAt: string;
};

type Cliente = {
  id: number;
  nombre: string;
  telefono: string | null;
  saldo: number;
  activo: boolean;
  movimientos: Movimiento[];
};

const TIPO_LABEL: Record<Tipo, string> = {
  CARGO: "Cargo (consumo)",
  PAGO: "Pago",
  INTERES: "Interés",
};

const TIPO_COLOR: Record<Tipo, string> = {
  CARGO: "text-red-400",
  PAGO: "text-emerald-400",
  INTERES: "text-blue-500",
};

const emptyEdit = { tipo: "PAGO" as Tipo, monto: "", metodo: "EFECTIVO" as Metodo, notas: "" };

export default function ClienteDetallePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const [cliente, setCliente] = useState<Cliente | null>(null);
  const [monto, setMonto] = useState("");
  const [metodo, setMetodo] = useState<Metodo>("EFECTIVO");
  const [notas, setNotas] = useState("");
  const [montoInteres, setMontoInteres] = useState("");
  const [notasInteres, setNotasInteres] = useState("");
  const [error, setError] = useState("");
  const [enviando, setEnviando] = useState(false);
  const [editandoId, setEditandoId] = useState<number | null>(null);
  const [edit, setEdit] = useState(emptyEdit);

  async function cargar() {
    const res = await fetch(`/api/clientes/${id}`);
    setCliente(await res.json());
  }

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- recarga al cambiar de cliente
    cargar();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  async function registrarPago(e: FormEvent) {
    e.preventDefault();
    setError("");
    if (!monto || Number(monto) <= 0) {
      setError("Ingresá un monto válido");
      return;
    }
    setEnviando(true);
    const res = await fetch(`/api/clientes/${id}/pagos`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ monto: Number(monto), metodo, notas }),
    });
    setEnviando(false);
    if (!res.ok) {
      const data = await res.json();
      setError(data.error || "Ocurrió un error");
      return;
    }
    setMonto("");
    setNotas("");
    await cargar();
  }

  async function agregarInteres(e: FormEvent) {
    e.preventDefault();
    setError("");
    if (!montoInteres || Number(montoInteres) <= 0) {
      setError("Ingresá un monto de interés válido");
      return;
    }
    setEnviando(true);
    const res = await fetch(`/api/clientes/${id}/interes`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ monto: Number(montoInteres), notas: notasInteres }),
    });
    setEnviando(false);
    if (!res.ok) {
      const data = await res.json();
      setError(data.error || "Ocurrió un error");
      return;
    }
    setMontoInteres("");
    setNotasInteres("");
    await cargar();
  }

  function iniciarEdicion(m: Movimiento) {
    setEditandoId(m.id);
    setEdit({ tipo: m.tipo, monto: String(m.monto), metodo: m.metodo || "EFECTIVO", notas: m.notas || "" });
  }

  function cancelarEdicion() {
    setEditandoId(null);
    setEdit(emptyEdit);
  }

  async function guardarEdicion(movId: number) {
    setError("");
    if (!edit.monto || Number(edit.monto) <= 0) {
      setError("Ingresá un monto válido");
      return;
    }
    const res = await fetch(`/api/clientes/${id}/movimientos/${movId}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        tipo: edit.tipo,
        monto: Number(edit.monto),
        metodo: edit.tipo === "PAGO" ? edit.metodo : null,
        notas: edit.notas,
      }),
    });
    if (!res.ok) {
      const data = await res.json();
      setError(data.error || "Ocurrió un error");
      return;
    }
    cancelarEdicion();
    await cargar();
  }

  async function eliminarMovimiento(movId: number) {
    if (!confirm("¿Eliminar este movimiento? El saldo se va a recalcular.")) return;
    setError("");
    const res = await fetch(`/api/clientes/${id}/movimientos/${movId}`, { method: "DELETE" });
    if (!res.ok) {
      const data = await res.json();
      setError(data.error || "Ocurrió un error");
      return;
    }
    await cargar();
  }

  if (!cliente) {
    return <div className="text-sm text-neutral-500">Cargando...</div>;
  }

  return (
    <div className="max-w-3xl mx-auto flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold tracking-tight text-neutral-900 dark:text-neutral-50">{cliente.nombre}</h1>
        <Link href="/clientes" className="text-sm text-neutral-500 dark:text-neutral-400 hover:text-neutral-700 dark:hover:text-neutral-200">
          Volver a clientes
        </Link>
      </div>

      <Card className="p-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <span className="text-neutral-500 dark:text-neutral-400">Saldo actual</span>
          {cliente.saldo > 0 ? (
            <Badge variant="danger">DEBE</Badge>
          ) : (
            <Badge variant="success">Al día</Badge>
          )}
        </div>
        <span className={`text-2xl font-semibold ${cliente.saldo > 0 ? "text-red-400" : "text-neutral-900 dark:text-neutral-50"}`}>
          ${formatearMoneda(cliente.saldo)}
        </span>
      </Card>

      <Card className="p-4 flex flex-col gap-3">
        <div className="text-sm font-medium text-neutral-700 dark:text-neutral-200">Registrar pago (cobrar)</div>
        <form onSubmit={registrarPago} className="flex flex-col gap-3">
          <div className="flex flex-wrap gap-2">
            {METODOS.map((m) => (
              <button
                key={m.value}
                type="button"
                onClick={() => setMetodo(m.value)}
                className={`px-3 py-1.5 rounded-full text-sm font-medium border transition-colors ${
                  metodo === m.value
                    ? "bg-blue-600 border-blue-600 text-neutral-950"
                    : "border-neutral-300 dark:border-neutral-700 text-neutral-700 dark:text-neutral-300 hover:border-neutral-500"
                }`}
              >
                {m.label}
              </button>
            ))}
          </div>
          <div className="flex items-end gap-3">
            <div className="flex-1">
              <label className={label}>Monto</label>
              <input
                type="number"
                step="0.01"
                className={input}
                value={monto}
                onChange={(e) => setMonto(e.target.value)}
                placeholder="Monto"
              />
            </div>
            <div className="flex-1">
              <label className={label}>Notas</label>
              <input className={input} value={notas} onChange={(e) => setNotas(e.target.value)} />
            </div>
            <Button type="submit" disabled={enviando} variant="primary">
              Registrar pago
            </Button>
          </div>
        </form>
      </Card>

      <Card className="p-4 flex flex-col gap-3">
        <div className="text-sm font-medium text-neutral-700 dark:text-neutral-200">Agregar interés</div>
        <form onSubmit={agregarInteres} className="flex items-end gap-3">
          <div className="flex-1">
            <label className={label}>Monto del interés</label>
            <input
              type="number"
              step="0.01"
              className={input}
              value={montoInteres}
              onChange={(e) => setMontoInteres(e.target.value)}
              placeholder="Se suma al saldo que debe"
            />
          </div>
          <div className="flex-1">
            <label className={label}>Notas</label>
            <input
              className={input}
              value={notasInteres}
              onChange={(e) => setNotasInteres(e.target.value)}
              placeholder="Ej: interés por mora"
            />
          </div>
          <Button type="submit" disabled={enviando} variant="secondary">
            Agregar interés
          </Button>
        </form>
      </Card>

      {error && <span className="text-sm text-red-400">{error}</span>}

      <Card>
        <div className="p-3 border-b border-neutral-200 dark:border-neutral-800 text-sm text-neutral-500 dark:text-neutral-400">Historial de movimientos</div>
        {cliente.movimientos.length === 0 ? (
          <div className="p-4 text-sm text-neutral-500">Sin movimientos todavía</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr>
                  <th className={th}>Fecha</th>
                  <th className={th}>Tipo</th>
                  <th className={th}>Método</th>
                  <th className={th}>Monto</th>
                  <th className={th}>Notas</th>
                  <th className={th}></th>
                </tr>
              </thead>
              <tbody>
                {cliente.movimientos.map((m) =>
                  editandoId === m.id ? (
                    <tr key={m.id} className={trHover}>
                      <td className={td}>{new Date(m.createdAt).toLocaleString("es-AR")}</td>
                      <td className={td}>
                        <select
                          className={input}
                          value={edit.tipo}
                          onChange={(e) => setEdit({ ...edit, tipo: e.target.value as Tipo })}
                        >
                          {TIPOS.map((t) => (
                            <option key={t.value} value={t.value}>
                              {t.label}
                            </option>
                          ))}
                        </select>
                      </td>
                      <td className={td}>
                        {edit.tipo === "PAGO" ? (
                          <select
                            className={input}
                            value={edit.metodo}
                            onChange={(e) => setEdit({ ...edit, metodo: e.target.value as Metodo })}
                          >
                            {METODOS.map((mo) => (
                              <option key={mo.value} value={mo.value}>
                                {mo.label}
                              </option>
                            ))}
                          </select>
                        ) : (
                          "-"
                        )}
                      </td>
                      <td className={td}>
                        <input
                          type="number"
                          step="0.01"
                          className={input}
                          value={edit.monto}
                          onChange={(e) => setEdit({ ...edit, monto: e.target.value })}
                        />
                      </td>
                      <td className={td}>
                        <input
                          className={input}
                          value={edit.notas}
                          onChange={(e) => setEdit({ ...edit, notas: e.target.value })}
                        />
                      </td>
                      <td className={`${td} text-right whitespace-nowrap`}>
                        <button
                          className="text-blue-500 hover:text-blue-400 mr-3"
                          onClick={() => guardarEdicion(m.id)}
                        >
                          Guardar
                        </button>
                        <button className="text-neutral-500 dark:text-neutral-400 hover:text-neutral-700 dark:hover:text-neutral-200" onClick={cancelarEdicion}>
                          Cancelar
                        </button>
                      </td>
                    </tr>
                  ) : (
                    <tr key={m.id} className={trHover}>
                      <td className={td}>{new Date(m.createdAt).toLocaleString("es-AR")}</td>
                      <td className={td}>
                        <span className={TIPO_COLOR[m.tipo]}>{TIPO_LABEL[m.tipo]}</span>
                        {m.ventaId && (
                          <span className="ml-2 text-xs text-neutral-500">(venta #{m.ventaId})</span>
                        )}
                      </td>
                      <td className={td}>{m.metodo ? METODOS.find((x) => x.value === m.metodo)?.label : "-"}</td>
                      <td className={td}>${formatearMoneda(m.monto)}</td>
                      <td className={td}>{m.notas || "-"}</td>
                      <td className={`${td} text-right whitespace-nowrap`}>
                        <button
                          className="text-blue-500 hover:text-blue-400 mr-3"
                          onClick={() => iniciarEdicion(m)}
                        >
                          Editar
                        </button>
                        <button
                          className="text-red-400 hover:text-red-300"
                          onClick={() => eliminarMovimiento(m.id)}
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
