"use client";

import { useEffect, useState } from "react";
import { invoke, isTauri } from "@tauri-apps/api/core";
import {
  imprimirLocal,
  listarImpresorasLocales,
  obtenerEstadoAgenteImpresion,
  obtenerImpresoraSeleccionada,
} from "@/lib/imprimir";

const CLAVE_ESTACION = "gestion_estacion_impresion_id";
const VERSION_MINIMA_AGENTE = "1.1.3";

type TrabajoPendiente = {
  id: number;
  tipo: "TICKET" | "COMANDA" | "PRUEBA";
  contenido: string;
  impresora: string | null;
};

function obtenerEstacionId() {
  let id = localStorage.getItem(CLAVE_ESTACION);
  if (!id) {
    id = crypto.randomUUID();
    localStorage.setItem(CLAVE_ESTACION, id);
  }
  return id;
}

function versionEsAnterior(actual: string, minima: string) {
  const partesActual = actual.split(".").map((parte) => Number(parte));
  const partesMinima = minima.split(".").map((parte) => Number(parte));
  if (
    partesActual.length < 3 ||
    partesActual.some((parte) => !Number.isInteger(parte) || parte < 0)
  ) {
    return true;
  }
  for (let i = 0; i < Math.max(partesActual.length, partesMinima.length); i += 1) {
    const diferencia = (partesActual[i] || 0) - (partesMinima[i] || 0);
    if (diferencia !== 0) return diferencia < 0;
  }
  return false;
}

export default function EstacionImpresion() {
  const [agenteDesactualizado, setAgenteDesactualizado] = useState("");
  const [actualizando, setActualizando] = useState(false);
  const [errorActualizacion, setErrorActualizacion] = useState("");

  async function actualizarWindows() {
    setActualizando(true);
    setErrorActualizacion("");
    try {
      await invoke("instalar_actualizacion");
    } catch {
      setActualizando(false);
      setErrorActualizacion("No se pudo iniciar automáticamente.");
    }
  }

  useEffect(() => {
    if (!isTauri()) return;

    let activo = true;
    let procesando = false;
    const estacionId = obtenerEstacionId();
    let impresorasDisponibles: string[] = [];
    let ultimaConsultaImpresoras = 0;
    let ultimaConsultaAgente = 0;
    let versionAgente = "";

    async function buscarEImprimir() {
      if (!activo || procesando || !obtenerImpresoraSeleccionada()) return;
      procesando = true;
      try {
        if (Date.now() - ultimaConsultaAgente > 15_000) {
          const estadoAgente = await obtenerEstadoAgenteImpresion();
          versionAgente = estadoAgente.agente;
          ultimaConsultaAgente = Date.now();
          const desactualizado =
            !estadoAgente.ok || versionEsAnterior(versionAgente, VERSION_MINIMA_AGENTE);
          setAgenteDesactualizado(desactualizado ? versionAgente || "desconocida" : "");
        }
        // Una versión vieja podía responder OK al navegador aunque Windows descartara
        // físicamente el trabajo. No tomarlo de la cola: así queda pendiente y se imprime
        // después de actualizar, en vez de quedar falsamente marcado como impreso.
        if (!versionAgente || versionEsAnterior(versionAgente, VERSION_MINIMA_AGENTE)) return;

        if (Date.now() - ultimaConsultaImpresoras > 30_000) {
          impresorasDisponibles = (await listarImpresorasLocales()).map((p) => p.nombre);
          ultimaConsultaImpresoras = Date.now();
        }
        const params = new URLSearchParams({ siguiente: "1" });
        impresorasDisponibles.forEach((nombre) => params.append("impresora", nombre));
        const listaRes = await fetch(`/api/impresion/cola?${params}`, { cache: "no-store" });
        if (!listaRes.ok) return;
        const lista = await listaRes.json();
        const candidato = lista.trabajos?.[0] as TrabajoPendiente | undefined;
        if (!candidato) return;

        const tomarRes = await fetch("/api/impresion/cola", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ accion: "tomar", id: candidato.id, estacionId }),
        });
        if (!tomarRes.ok) return;
        const trabajo = (await tomarRes.json()) as TrabajoPendiente;

        const ok = await imprimirLocal(trabajo.contenido, trabajo.impresora);
        await fetch("/api/impresion/cola", {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            id: trabajo.id,
            estacionId,
            ok,
            error: ok ? null : "El agente local no pudo completar la impresión",
          }),
        });
        window.dispatchEvent(new CustomEvent("gestion:impresion", { detail: { ok, trabajo } }));
      } catch (error) {
        console.warn("Error procesando la cola de impresión:", error);
      } finally {
        procesando = false;
      }
    }

    buscarEImprimir();
    const intervalo = window.setInterval(buscarEImprimir, 1500);
    return () => {
      activo = false;
      window.clearInterval(intervalo);
    };
  }, []);

  if (!agenteDesactualizado) return null;

  return (
    <div className="fixed inset-x-3 bottom-3 z-[100] mx-auto flex max-w-3xl flex-col gap-2 rounded-xl border border-red-300 bg-red-50 px-4 py-3 text-sm text-red-950 shadow-2xl sm:flex-row sm:items-center sm:justify-between dark:border-red-800 dark:bg-red-950 dark:text-red-50">
      <div>
        <span>
          <strong>Impresión detenida:</strong> el agente instalado es {agenteDesactualizado} y se
          necesita la versión {VERSION_MINIMA_AGENTE}. Las comandas quedarán pendientes para no
          perderlas.
        </span>
        <p className="mt-1 font-medium">La actualización 0.1.14 corrige el agente automáticamente.</p>
        {errorActualizacion && <p className="mt-1 font-medium">{errorActualizacion}</p>}
      </div>
      <div className="flex shrink-0 flex-wrap gap-2">
        <button
          type="button"
          onClick={actualizarWindows}
          disabled={actualizando}
          className="rounded-lg bg-red-700 px-3 py-2 text-center font-semibold text-white hover:bg-red-800 disabled:opacity-60"
        >
          {actualizando ? "Actualizando..." : "Instalar actualización 0.1.14"}
        </button>
      </div>
    </div>
  );
}
