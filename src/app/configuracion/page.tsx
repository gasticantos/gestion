"use client";

import { useEffect, useState, FormEvent } from "react";
import Card from "@/components/ui/Card";
import Button from "@/components/ui/Button";
import Badge from "@/components/ui/Badge";
import { input, label, th, td, trHover } from "@/components/ui/styles";

type Categoria = { id: number; nombre: string; activo: boolean };

type AuditoriaLog = {
  id: number;
  accion: string;
  descripcion: string | null;
  createdAt: string;
  usuario: { nombre: string; email: string; rol: string };
};

export default function ConfiguracionPage() {
  const [recargoMesaPct, setRecargoMesaPct] = useState("0");
  const [ok, setOk] = useState("");
  const [error, setError] = useState("");
  const [enviando, setEnviando] = useState(false);

  const [categorias, setCategorias] = useState<Categoria[]>([]);
  const [nombreCategoria, setNombreCategoria] = useState("");
  const [editandoId, setEditandoId] = useState<number | null>(null);
  const [errorCategoria, setErrorCategoria] = useState("");
  const [mostrarInactivas, setMostrarInactivas] = useState(false);

  const [confirmacionBorrado, setConfirmacionBorrado] = useState("");
  const [borrando, setBorrando] = useState(false);
  const [errorBorrado, setErrorBorrado] = useState("");
  const [okBorrado, setOkBorrado] = useState("");

  const [logs, setLogs] = useState<AuditoriaLog[]>([]);
  const [cargandoLogs, setCargandoLogs] = useState(false);

  async function cargar() {
    const [configRes, catRes] = await Promise.all([fetch("/api/configuracion"), fetch("/api/categorias")]);
    const data = await configRes.json();
    setRecargoMesaPct(String(data.recargoMesaPct));
    setCategorias(await catRes.json());
  }

  async function cargarLogs() {
    setCargandoLogs(true);
    const res = await fetch("/api/auditoria?limit=50");
    if (res.ok) {
      const data = await res.json();
      setLogs(data.logs);
    }
    setCargandoLogs(false);
  }

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- carga inicial de datos al montar la página
    cargar();
    cargarLogs();
  }, []);

  async function guardar(e: FormEvent) {
    e.preventDefault();
    setError("");
    setOk("");
    setEnviando(true);
    const res = await fetch("/api/configuracion", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ recargoMesaPct: Number(recargoMesaPct) }),
    });
    setEnviando(false);
    if (!res.ok) {
      const data = await res.json();
      setError(data.error || "Ocurrió un error");
      return;
    }
    setOk("Guardado");
  }

  async function guardarCategoria(e: FormEvent) {
    e.preventDefault();
    setErrorCategoria("");

    const res = await fetch(editandoId ? `/api/categorias/${editandoId}` : "/api/categorias", {
      method: editandoId ? "PUT" : "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ nombre: nombreCategoria }),
    });

    if (!res.ok) {
      const data = await res.json();
      setErrorCategoria(data.error || "Ocurrió un error");
      return;
    }

    setNombreCategoria("");
    setEditandoId(null);
    await cargar();
  }

  function editarCategoria(c: Categoria) {
    setEditandoId(c.id);
    setNombreCategoria(c.nombre);
  }

  async function darDeBajaCategoria(id: number) {
    if (!confirm("¿Dar de baja esta categoría?")) return;
    await fetch(`/api/categorias/${id}`, { method: "DELETE" });
    await cargar();
  }

  async function reactivarCategoria(c: Categoria) {
    await fetch(`/api/categorias/${c.id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ nombre: c.nombre, activo: true }),
    });
    await cargar();
  }

  const listadoCategorias = categorias.filter((c) => mostrarInactivas || c.activo);

  async function borrarDatos() {
    setErrorBorrado("");
    setOkBorrado("");
    if (!confirm("Esto borra productos, categorías, proveedores, mesas, clientes, ventas, pedidos y cuentas corrientes. No borra usuarios ni te desloguea. ¿Confirmás?")) {
      return;
    }
    setBorrando(true);
    const res = await fetch("/api/admin/reset-datos", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ confirmacion: confirmacionBorrado }),
    });
    setBorrando(false);
    if (!res.ok) {
      const data = await res.json();
      setErrorBorrado(data.error || "Ocurrió un error");
      return;
    }
    setConfirmacionBorrado("");
    setOkBorrado("Listo, todos los datos del negocio fueron borrados.");
    await cargar();
  }

  return (
    <div className="max-w-md mx-auto flex flex-col gap-6">
      <h1 className="text-2xl font-semibold tracking-tight text-neutral-50">Configuración</h1>

      <Card className="p-4">
        <form onSubmit={guardar} className="flex flex-col gap-3">
          <div>
            <label className={label}>Recargo por venta de mesa (%)</label>
            <input
              type="number"
              step="0.01"
              min="0"
              className={input}
              value={recargoMesaPct}
              onChange={(e) => setRecargoMesaPct(e.target.value)}
            />
            <p className="text-xs text-neutral-500 mt-1">
              Se aplica sobre el precio de cada producto cuando la venta se cobra como &quot;Mesa&quot; en vez
              de &quot;Particular&quot;.
            </p>
          </div>
          <div className="flex items-center gap-3">
            <Button type="submit" variant="primary" disabled={enviando}>
              Guardar
            </Button>
            {ok && <span className="text-sm text-emerald-400">{ok}</span>}
            {error && <span className="text-sm text-red-400">{error}</span>}
          </div>
        </form>
      </Card>

      <Card className="p-4 flex flex-col gap-3">
        <div className="text-sm font-medium text-neutral-200">Categorías de productos</div>
        <form onSubmit={guardarCategoria} className="flex items-center gap-2">
          <input
            className={input}
            placeholder="Nombre de la categoría"
            value={nombreCategoria}
            onChange={(e) => setNombreCategoria(e.target.value)}
            required
          />
          <Button type="submit" variant="primary">
            {editandoId ? "Guardar" : "Agregar"}
          </Button>
          {editandoId && (
            <Button
              type="button"
              variant="ghost"
              onClick={() => {
                setEditandoId(null);
                setNombreCategoria("");
              }}
            >
              Cancelar
            </Button>
          )}
        </form>
        {errorCategoria && <span className="text-sm text-red-400">{errorCategoria}</span>}

        <div className="flex items-center justify-between">
          <span className="text-xs text-neutral-500">{listadoCategorias.length} categoría(s)</span>
          <label className="flex items-center gap-2 text-xs text-neutral-500">
            <input
              type="checkbox"
              checked={mostrarInactivas}
              onChange={(e) => setMostrarInactivas(e.target.checked)}
            />
            Mostrar dadas de baja
          </label>
        </div>

        <table className="w-full">
          <thead>
            <tr>
              <th className={th}>Nombre</th>
              <th className={th}></th>
            </tr>
          </thead>
          <tbody>
            {listadoCategorias.map((c) => (
              <tr key={c.id} className={`${trHover} ${!c.activo ? "opacity-40" : ""}`}>
                <td className={td}>{c.nombre}</td>
                <td className={`${td} text-right whitespace-nowrap`}>
                  {c.activo ? (
                    <>
                      <button className="text-blue-500 hover:text-blue-400 mr-3" onClick={() => editarCategoria(c)}>
                        Editar
                      </button>
                      <button className="text-red-400 hover:text-red-300" onClick={() => darDeBajaCategoria(c.id)}>
                        Dar de baja
                      </button>
                    </>
                  ) : (
                    <>
                      <Badge variant="neutral" className="mr-3">
                        Baja
                      </Badge>
                      <button className="text-emerald-400 hover:text-emerald-300" onClick={() => reactivarCategoria(c)}>
                        Reactivar
                      </button>
                    </>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </Card>

      <Card className="p-4 flex flex-col gap-3 border-red-900/50">
        <div className="text-sm font-medium text-red-400">Zona de peligro</div>
        <p className="text-xs text-neutral-500">
          Borra productos, categorías, proveedores, mesas, clientes, ventas, pedidos y cuentas corrientes —
          útil para vaciar datos de prueba y arrancar de cero. No borra usuarios: tu login se mantiene.
          Esta acción no se puede deshacer.
        </p>
        <div>
          <label className={label}>
            Escribí <span className="font-mono text-neutral-300">BORRAR TODO</span> para habilitar el botón
          </label>
          <input
            className={input}
            value={confirmacionBorrado}
            onChange={(e) => setConfirmacionBorrado(e.target.value)}
            placeholder="BORRAR TODO"
          />
        </div>
        <div className="flex items-center gap-3">
          <Button
            type="button"
            variant="danger"
            disabled={confirmacionBorrado !== "BORRAR TODO" || borrando}
            onClick={borrarDatos}
          >
            {borrando ? "Borrando…" : "Borrar todos los datos del negocio"}
          </Button>
          {okBorrado && <span className="text-sm text-emerald-400">{okBorrado}</span>}
          {errorBorrado && <span className="text-sm text-red-400">{errorBorrado}</span>}
        </div>
      </Card>

      <Card className="p-4 flex flex-col gap-3">
        <div className="flex items-center justify-between">
          <div className="text-sm font-medium text-neutral-200">Consola de auditoría</div>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={cargarLogs}
            disabled={cargandoLogs}
          >
            {cargandoLogs ? "Cargando…" : "Actualizar"}
          </Button>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="sticky top-0 z-10 bg-neutral-900 border-b border-neutral-800">
                <th className={`${th} text-left`}>Fecha y hora</th>
                <th className={`${th} text-left`}>Usuario</th>
                <th className={`${th} text-left`}>Acción</th>
                <th className={`${th} text-left`}>Detalles</th>
              </tr>
            </thead>
            <tbody className="max-h-96 overflow-y-auto block w-full">
              {logs.length === 0 ? (
                <tr>
                  <td colSpan={4} className="p-3 text-center text-neutral-500 text-sm">
                    No hay movimientos registrados
                  </td>
                </tr>
              ) : (
                logs.map((log) => (
                  <tr key={log.id} className={trHover}>
                    <td className={`${td} text-xs text-neutral-400 whitespace-nowrap`}>
                      {new Date(log.createdAt).toLocaleString("es-AR")}
                    </td>
                    <td className={`${td} text-xs`}>
                      <span className="font-medium">{log.usuario.nombre}</span>
                      <Badge variant="neutral" className="ml-1 text-[10px]">
                        {log.usuario.rol}
                      </Badge>
                    </td>
                    <td className={`${td} text-xs font-mono text-blue-400`}>{log.accion}</td>
                    <td className={`${td} text-xs text-neutral-400`}>{log.descripcion || "—"}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}
