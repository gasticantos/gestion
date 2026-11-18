"use client";

import { useEffect, useState } from "react";
import { createClient, type RealtimeChannel } from "@supabase/supabase-js";
import { invoke, isTauri } from "@tauri-apps/api/core";
import {
  guardarImpresoraSeleccionada,
  imprimirLocal,
  listarImpresorasLocales,
  obtenerEstadoAgenteImpresion,
  obtenerImpresoraSeleccionada,
} from "@/lib/imprimir";

const CLAVE_ESTACION = "gestion_estacion_impresion_id";
const TOPICO_REALTIME_IMPRESION = "gestion-impresion";
const VERSION_MINIMA_AGENTE = "1.3.0";

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
  const [esEstacionPrincipal, setEsEstacionPrincipal] = useState<boolean | null>(null);
  const [hayOtraCajaConfigurada, setHayOtraCajaConfigurada] = useState(false);
  const [guardandoEstacion, setGuardandoEstacion] = useState(false);
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

  async function establecerComoPrincipal() {
    // Ya hay otra caja fijada: confirmar para no pisarla sin querer desde otra
    // computadora (eso dejó a la caja real sin poder imprimir).
    if (
      hayOtraCajaConfigurada &&
      !window.confirm(
        "Ya hay otra computadora fijada como caja principal. Si continuás, esa computadora dejará de imprimir y pasará a imprimir esta. ¿Confirmás el cambio?"
      )
    ) {
      return;
    }
    setGuardandoEstacion(true);
    try {
      const res = await fetch("/api/impresion/estacion", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ estacionId: obtenerEstacionId() }),
      });
      if (res.ok) setEsEstacionPrincipal(true);
    } finally {
      setGuardandoEstacion(false);
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
    let canalRealtime: RealtimeChannel | null = null;

    async function asegurarImpresoraSeleccionada() {
      const guardada = obtenerImpresoraSeleccionada();
      if (guardada) return guardada;

      const disponibles = await listarImpresorasLocales();
      const elegida =
        disponibles.find((impresora) => impresora.predeterminada && !impresora.desconectada) ||
        disponibles.find((impresora) => !impresora.desconectada) ||
        disponibles.find((impresora) => impresora.predeterminada) ||
        disponibles[0];

      if (!elegida) return "";
      guardarImpresoraSeleccionada(elegida.nombre);
      return elegida.nombre;
    }

    async function comprobarEstacion() {
      try {
        const res = await fetch(
          `/api/impresion/estacion?estacionId=${encodeURIComponent(estacionId)}`,
          { cache: "no-store" }
        );
        if (res.ok) {
          const data = await res.json();
          setEsEstacionPrincipal(data.principal === true);
          setHayOtraCajaConfigurada(data.configurada === true && data.principal !== true);
        }
      } catch {
        setEsEstacionPrincipal(false);
      }
    }

    async function buscarEImprimir() {
      if (!activo || procesando || esEstacionPrincipal !== true) return;
      procesando = true;
      try {
        // La primera vez que abre la aplicación en esta computadora, tomar y guardar
        // automáticamente la impresora predeterminada de Windows. Antes esto ocurría
        // recién al entrar a Configuración y obligaba a repetir ese paso al iniciar.
        if (!(await asegurarImpresoraSeleccionada())) return;

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
        // La ruta ya busca y toma el trabajo en una sola consulta (evita el viaje de red
        // extra que antes hacía falta para reservarlo con un POST "tomar" aparte).
        const params = new URLSearchParams({ siguiente: "1", estacionId });
        impresorasDisponibles.forEach((nombre) => params.append("impresora", nombre));
        const listaRes = await fetch(`/api/impresion/cola?${params}`, { cache: "no-store" });
        if (!listaRes.ok) return;
        const lista = await listaRes.json();
        const trabajo = lista.trabajos?.[0] as TrabajoPendiente | undefined;
        if (!trabajo) return;

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

    comprobarEstacion();
    const intervaloEstacion = window.setInterval(comprobarEstacion, 15_000);
    buscarEImprimir();
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
    if (supabaseUrl && supabaseKey) {
      const realtime = createClient(supabaseUrl, supabaseKey, {
        auth: { persistSession: false, autoRefreshToken: false },
      });
      canalRealtime = realtime
        .channel(TOPICO_REALTIME_IMPRESION)
        .on("broadcast", { event: "nueva_impresion" }, () => void buscarEImprimir())
        .subscribe();
    }
    // Realtime despierta la estación al instante. Este sondeo lento es solo un seguro ante
    // cortes de WebSocket o avisos perdidos; la cola persistente nunca depende del canal.
    const intervalo = window.setInterval(buscarEImprimir, 5_000);
    return () => {
      activo = false;
      if (canalRealtime) void canalRealtime.unsubscribe();
      window.clearInterval(intervalo);
      window.clearInterval(intervaloEstacion);
    };
  }, [esEstacionPrincipal]);

  if (agenteDesactualizado) {
    return (
      <div className="fixed inset-x-3 bottom-3 z-[100] mx-auto flex max-w-3xl flex-col gap-2 rounded-xl border border-red-300 bg-red-50 px-4 py-3 text-sm text-red-950 shadow-2xl sm:flex-row sm:items-center sm:justify-between dark:border-red-800 dark:bg-red-950 dark:text-red-50">
        <div>
          <span>
            <strong>Impresión detenida:</strong> el agente instalado es {agenteDesactualizado} y se
            necesita la versión {VERSION_MINIMA_AGENTE}. Las comandas quedarán pendientes para no
            perderlas.
          </span>
          <p className="mt-1 font-medium">La actualización incorpora impresión rápida y respaldo automático.</p>
          {errorActualizacion && <p className="mt-1 font-medium">{errorActualizacion}</p>}
        </div>
        <button
          type="button"
          onClick={actualizarWindows}
          disabled={actualizando}
          className="rounded-lg bg-red-700 px-3 py-2 text-center font-semibold text-white hover:bg-red-800 disabled:opacity-60"
        >
          {actualizando ? "Actualizando..." : "Instalar actualización"}
        </button>
      </div>
    );
  }

  if (esEstacionPrincipal === false) {
    return (
      <div className="group fixed bottom-3 right-3 z-[100] flex max-w-[calc(100vw-1.5rem)] items-center justify-end rounded-full border border-amber-300 bg-amber-50 text-sm text-amber-950 shadow-lg transition-all duration-200 hover:rounded-xl focus-within:rounded-xl dark:border-amber-800 dark:bg-amber-950 dark:text-amber-50">
        <div className="max-w-0 overflow-hidden opacity-0 transition-all duration-200 group-hover:max-w-[34rem] group-hover:opacity-100 group-focus-within:max-w-[34rem] group-focus-within:opacity-100">
          <div className="flex min-w-[min(34rem,calc(100vw-5rem))] items-center gap-3 py-2 pl-3">
            <span className="leading-snug">
              <strong>Esta computadora no es la caja principal.</strong>{" "}
              {hayOtraCajaConfigurada
                ? "Ya hay otra caja fijada; cambiala solo si es a propósito."
                : "Podés activarla para imprimir comandas y tickets acá."}
            </span>
            <button
              type="button"
              onClick={establecerComoPrincipal}
              disabled={guardandoEstacion}
              className="shrink-0 rounded-lg bg-amber-700 px-3 py-2 text-xs font-semibold text-white hover:bg-amber-800 disabled:opacity-60"
            >
              {guardandoEstacion ? "Activando..." : "Usar para imprimir"}
            </button>
          </div>
        </div>
        <button
          type="button"
          aria-label="Esta computadora es una caja secundaria"
          title="Caja secundaria · acercá el mouse para ver opciones"
          className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-amber-100 text-base font-bold text-amber-800 transition-colors group-hover:bg-transparent group-focus-within:bg-transparent dark:bg-amber-900 dark:text-amber-200"
        >
          i
        </button>
      </div>
    );
  }

  return null;
}
