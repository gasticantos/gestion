"use client";

import { useEffect, useState, Suspense, lazy } from "react";
import Link from "next/link";
import dynamic from "next/dynamic";
import Button from "@/components/ui/Button";
import { formatearMoneda } from "@/lib/formato";

const MapaMesas = dynamic(() => import("@/components/MapaMesas"), { loading: () => <div className="h-96 bg-neutral-800 rounded-lg animate-pulse" /> });

type Mesa = {
  id: number;
  nombre: string;
  estado: "LIBRE" | "OCUPADA";
  posX: number;
  posY: number;
  ventas: { total: number }[];
};

export default function MesasPage() {
  const [mesas, setMesas] = useState<Mesa[]>([]);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [vista, setVista] = useState<"mapa" | "lista">("mapa");
  const [agragando, setAgregando] = useState(false);

  async function cargar() {
    setLoading(true);
    const mesasRes = await fetch("/api/mesas");
    setMesas(await mesasRes.json());
    setLoading(false);
  }

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- carga inicial de datos al montar la página
    cargar();
  }, []);

  async function agregarMesa() {
    setError("");
    setAgregando(true);
    const res = await fetch("/api/mesas", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({}),
    });
    setAgregando(false);
    if (!res.ok) {
      const data = await res.json();
      setError(data.error || "Ocurrió un error");
      return;
    }
    await cargar();
  }

  async function borrarMesa(id: number) {
    if (!confirm("¿Estás seguro? Se devolverá el stock de todas las ventas")) return;
    const res = await fetch(`/api/mesas/${id}/delete`, { method: "DELETE" });
    if (!res.ok) {
      const data = await res.json();
      setError(data.error || "Ocurrió un error");
      return;
    }
    await cargar();
  }

  return (
    <div className="max-w-5xl mx-auto flex flex-col gap-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <h1 className="text-2xl font-semibold tracking-tight text-neutral-50">Mesas</h1>
        <div className="flex gap-1 bg-neutral-900 border border-neutral-800 rounded-lg p-1">
          <button
            onClick={() => setVista("mapa")}
            className={`px-3 py-1 rounded-md text-sm font-medium transition-colors ${
              vista === "mapa" ? "bg-blue-600 text-neutral-950" : "text-neutral-400 hover:text-neutral-200"
            }`}
          >
            Mapa
          </button>
          <button
            onClick={() => setVista("lista")}
            className={`px-3 py-1 rounded-md text-sm font-medium transition-colors ${
              vista === "lista" ? "bg-blue-600 text-neutral-950" : "text-neutral-400 hover:text-neutral-200"
            }`}
          >
            Lista
          </button>
        </div>
      </div>

      <div className="flex items-center gap-2">
        <Button onClick={agregarMesa} variant="primary" disabled={agragando}>
          {agragando ? "Creando..." : "Agregar mesa"}
        </Button>
        {error && <span className="text-sm text-red-400">{error}</span>}
      </div>

      {loading ? (
        <div className="text-sm text-neutral-500">Cargando...</div>
      ) : vista === "mapa" ? (
        <>
          <p className="text-xs text-neutral-500 -mt-2">
            Arrastrá las mesas para acomodarlas como están en el local. Un click simple sobre una mesa la
            abre. El mostrador y la puerta quedan siempre fijos.
          </p>
          <MapaMesas
            mesas={mesas.map((m) => ({
              id: m.id,
              nombre: m.nombre,
              estado: m.estado,
              posX: m.posX,
              posY: m.posY,
              total: m.ventas[0]?.total ?? 0,
            }))}
          />
        </>
      ) : mesas.length === 0 ? (
        <div className="text-sm text-neutral-500">Todavía no hay mesas cargadas</div>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
          {mesas.map((mesa) => (
            <div
              key={mesa.id}
              className={`rounded-xl p-4 border text-center transition-colors ${
                mesa.estado === "OCUPADA"
                  ? "bg-red-500/10 border-red-500/30"
                  : "bg-neutral-900 border-neutral-800 hover:border-emerald-500/50"
              }`}
            >
              <Link
                href={`/mesas/${mesa.id}`}
                className="block hover:opacity-70 transition-opacity"
              >
                <div className="font-medium text-neutral-100">{mesa.nombre}</div>
                <div
                  className={`text-xs mt-1 font-medium ${
                    mesa.estado === "OCUPADA" ? "text-red-400" : "text-emerald-400"
                  }`}
                >
                  {mesa.estado === "OCUPADA" ? "Ocupada" : "Libre"}
                </div>
                {mesa.ventas[0] && (
                  <div className="text-sm font-semibold mt-2 text-neutral-100">
                    ${formatearMoneda(mesa.ventas[0].total)}
                  </div>
                )}
              </Link>
              <button
                onClick={() => borrarMesa(mesa.id)}
                className="mt-3 w-full text-xs px-2 py-1 rounded border border-red-600/50 text-red-400 hover:bg-red-600/10 transition-colors"
              >
                Borrar
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
