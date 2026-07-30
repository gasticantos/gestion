"use client";

import { useEffect } from "react";
import { isTauri } from "@tauri-apps/api/core";
import { imprimirLocal, obtenerImpresoraSeleccionada } from "@/lib/imprimir";

const CLAVE_ESTACION = "gestion_estacion_impresion_id";

type TrabajoPendiente = {
  id: number;
  tipo: "TICKET" | "COMANDA" | "PRUEBA";
  contenido: string;
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

    async function buscarEImprimir() {
      if (!activo || procesando || !obtenerImpresoraSeleccionada()) return;
      procesando = true;
      try {
        const listaRes = await fetch("/api/impresion/cola?siguiente=1", { cache: "no-store" });
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

        const ok = await imprimirLocal(trabajo.contenido);
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
