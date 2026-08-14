"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import dynamic from "next/dynamic";
import Button from "@/components/ui/Button";
import { formatearMoneda } from "@/lib/formato";
import { useData } from "@/hooks/useData";

const MapaMesas = dynamic(() => import("@/components/MapaMesas"), { loading: () => <div className="h-96 bg-neutral-200 dark:bg-neutral-800 rounded-lg animate-pulse" /> });

type Mesa = {
  id: number;
  nombre: string;
  numero: number;
  apodo: string | null;
  estado: "LIBRE" | "OCUPADA";
  posX: number;
  posY: number;
  ancho: number;
  alto: number;
  ventas: { total: number; ticketImpreso: boolean }[];
};

export default function MesasPage() {
  const { data: mesasCache, loading: loadingCache } = useData<Mesa>("mesas");
  const [mesasFrescas, setMesasFrescas] = useState<Mesa[] | null>(null);
  const [error, setError] = useState("");
  const [vista, setVista] = useState<"mapa" | "lista">("mapa");
  const [agragando, setAgregando] = useState(false);
  const [moviendoDesde, setMoviendoDesde] = useState<number | null>(null);
  const [moviendo, setMoviendo] = useState(false);
  const [rol, setRol] = useState<string | null>(null);

  // Mientras no se haya hecho un fetch propio (cargar()), mostrar lo que trae el caché.
  const mesas = mesasFrescas ?? mesasCache ?? [];
  const subtotalSinCobrar = mesas.reduce((acc, m) => acc + (m.ventas[0]?.total ?? 0), 0);

  useEffect(() => {
    fetch("/api/auth/me")
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => setRol(data?.rol ?? null))
      .catch(() => setRol(null));
  }, []);

  async function cargar() {
    const mesasRes = await fetch("/api/mesas");
    const data = await mesasRes.json();
    setMesasFrescas(data);
  }

  useEffect(() => {
    // Recargar cuando el usuario vuelve a la pestaña (tab activo)
    const handleVisibilityChange = () => {
      if (!document.hidden) {
        cargar();
      }
    };

    document.addEventListener("visibilitychange", handleVisibilityChange);
    return () => document.removeEventListener("visibilitychange", handleVisibilityChange);
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
    if (!confirm("¿Estás seguro? Se borra la mesa; el historial de ventas ya cobradas queda intacto.")) return;
    const res = await fetch(`/api/mesas/${id}/delete`, { method: "DELETE" });
    if (!res.ok) {
      const data = await res.json();
      setError(data.error || "Ocurrió un error");
      return;
    }
    await cargar();
  }

  async function moverMesa(origenId: number, destinoId: number) {
    setError("");
    setMoviendo(true);
    const res = await fetch(`/api/mesas/${origenId}/mover`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ destinoId }),
    });
    setMoviendo(false);
    setMoviendoDesde(null);
    if (!res.ok) {
      const data = await res.json().catch(() => null);
      setError(data?.error || "No se pudo mover la mesa");
      return;
    }
    await cargar();
  }

  return (
    <div className="max-w-5xl mx-auto flex flex-col gap-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <h1 className="text-2xl font-semibold tracking-tight text-neutral-900 dark:text-neutral-50">Mesas</h1>
        <div className="flex gap-1 bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-lg p-1">
          <button
            onClick={() => setVista("mapa")}
            className={`px-3 py-1 rounded-md text-sm font-medium transition-colors ${
              vista === "mapa" ? "bg-blue-600 text-neutral-950" : "text-neutral-500 dark:text-neutral-400 hover:text-neutral-700 dark:hover:text-neutral-200"
            }`}
          >
            Mapa
          </button>
          <button
            onClick={() => setVista("lista")}
            className={`px-3 py-1 rounded-md text-sm font-medium transition-colors ${
              vista === "lista" ? "bg-blue-600 text-neutral-950" : "text-neutral-500 dark:text-neutral-400 hover:text-neutral-700 dark:hover:text-neutral-200"
            }`}
          >
            Lista
          </button>
        </div>
      </div>

      {rol === "DUENIO" && (
        <div className="flex justify-center">
          <div className="text-center px-6 py-2 rounded-lg bg-amber-500/10 border border-amber-500/30">
            <span className="text-xs text-amber-500 font-medium">Total mesas sin cobrar: </span>
            <span className="text-lg font-bold text-amber-500">${formatearMoneda(subtotalSinCobrar)}</span>
          </div>
        </div>
      )}

      <div className="flex items-center gap-2">
        <Button onClick={agregarMesa} variant="primary" disabled={agragando}>
          {agragando ? "Creando..." : "Agregar mesa"}
        </Button>
        {error && <span className="text-sm text-red-400">{error}</span>}
      </div>

      {loadingCache && mesas.length === 0 ? (
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
              nombre: m.apodo || m.nombre,
              estado: m.estado,
              posX: m.posX,
              posY: m.posY,
              ancho: m.ancho,
              alto: m.alto,
              total: m.ventas[0]?.total ?? 0,
              ticketImpreso: m.ventas[0]?.ticketImpreso ?? false,
            }))}
          />
        </>
      ) : mesas.length === 0 ? (
        <div className="text-sm text-neutral-500">Todavía no hay mesas cargadas</div>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
          {mesas.map((mesa) => {
            const ticketImpreso = mesa.ventas[0]?.ticketImpreso ?? false;
            return (
            <div
              key={mesa.id}
              className={`relative rounded-xl p-4 border text-center transition-colors ${
                ticketImpreso
                  ? "bg-amber-500/10 border-amber-500/30"
                  : mesa.estado === "OCUPADA"
                    ? "bg-red-500/10 border-red-500/30"
                    : "bg-white dark:bg-neutral-900 border-neutral-200 dark:border-neutral-800 hover:border-emerald-500/50"
              }`}
            >
              {mesa.estado === "OCUPADA" && (
                <div className="absolute top-1.5 right-1.5 z-10">
                  <button
                    onClick={() => setMoviendoDesde(moviendoDesde === mesa.id ? null : mesa.id)}
                    title="Cambiar de mesa"
                    className="w-6 h-6 flex items-center justify-center rounded border border-neutral-300 dark:border-neutral-700 bg-white dark:bg-neutral-900 text-neutral-500 dark:text-neutral-400 hover:text-neutral-800 dark:hover:text-neutral-100 text-xs"
                  >
                    ⇄
                  </button>
                  {moviendoDesde === mesa.id && (
                    <div className="absolute right-0 top-full mt-1 w-48 rounded-lg border border-neutral-300 dark:border-neutral-700 bg-white dark:bg-neutral-900 shadow-lg p-2 flex flex-col gap-1 text-left">
                      <div className="text-xs text-neutral-500 px-1 pb-1">Mover a...</div>
                      {mesas.filter((m) => m.estado === "LIBRE").length === 0 ? (
                        <div className="text-xs text-neutral-500 px-1 py-2">No hay mesas libres</div>
                      ) : (
                        mesas
                          .filter((m) => m.estado === "LIBRE")
                          .map((libre) => (
                            <button
                              key={libre.id}
                              disabled={moviendo}
                              onClick={() => moverMesa(mesa.id, libre.id)}
                              className="text-left text-sm px-2 py-1.5 rounded hover:bg-neutral-100 dark:hover:bg-neutral-800 disabled:opacity-50"
                            >
                              {libre.apodo || libre.nombre}
                            </button>
                          ))
                      )}
                      <button
                        onClick={() => setMoviendoDesde(null)}
                        className="text-left text-xs text-neutral-500 px-2 py-1 hover:text-neutral-700 dark:hover:text-neutral-300"
                      >
                        Cancelar
                      </button>
                    </div>
                  )}
                </div>
              )}
              <Link
                href={`/mesas/${mesa.id}`}
                className="block hover:opacity-70 transition-opacity"
              >
                <div className="font-medium text-neutral-800 dark:text-neutral-100">{mesa.apodo || mesa.nombre}</div>
                <div
                  className={`text-xs mt-1 font-medium ${
                    ticketImpreso ? "text-amber-400" : mesa.estado === "OCUPADA" ? "text-red-400" : "text-emerald-400"
                  }`}
                >
                  {ticketImpreso ? "Esperando pago" : mesa.estado === "OCUPADA" ? "Ocupada" : "Libre"}
                </div>
                {mesa.ventas[0] && (
                  <div className="text-sm font-semibold mt-2 text-neutral-800 dark:text-neutral-100">
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
            );
          })}
        </div>
      )}
    </div>
  );
}
