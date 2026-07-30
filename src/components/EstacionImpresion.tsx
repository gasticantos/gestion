"use client";

import { useEffect } from "react";
import { isTauri } from "@tauri-apps/api/core";
import {
  imprimirLocal,
  listarImpresorasLocales,
  obtenerImpresoraSeleccionada,
} from "@/lib/imprimir";

const CLAVE_ESTACION = "gestion_estacion_impresion_id";

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

export default function EstacionImpresion() {
  useEffect(() => {
    if (!isTauri()) return;

    let activo = true;
    let procesando = false;
    const estacionId = obtenerEstacionId();
    let impresorasDisponibles: string[] = [];
    let ultimaConsultaImpresoras = 0;

    async function buscarEImprimir() {
      if (!activo || procesando || !obtenerImpresoraSeleccionada()) return;
      procesando = true;
      try {
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

  return null;
}
