import { isTauri } from "@tauri-apps/api/core";

// Puerto donde escucha el agente local de impresión (ver /print-agent en la raíz del repo).
// Corre en la PC de la caja y manda el ticket directo a la impresora por USB, sin pasar por
// el navegador: así no aparece ningún diálogo de confirmación de impresión.
function agenteImpresionUrl() {
  // La aplicación Windows usa un puerto propio para no chocar con una instalación anterior
  // del agente independiente.
  return isTauri() ? "http://127.0.0.1:9850" : "http://127.0.0.1:9847";
}
const CLAVE_IMPRESORA = "gestion_impresora_seleccionada";
let ultimoErrorImpresion = "";

export type ImpresoraLocal = {
  nombre: string;
  predeterminada: boolean;
  desconectada: boolean;
  estado: string;
};

export type EstadoAgenteImpresion = {
  ok: boolean;
  agente: string;
};

export const ERROR_IMPRESION_LOCAL =
  "No se pudo imprimir automáticamente. Elegí una impresora en Configuración y verificá que el agente esté iniciado. No se abrió el diálogo del navegador.";

// Intenta imprimir a través del agente local. Devuelve true si lo logró; false si el agente
// no está corriendo en esta máquina (por ejemplo, un celular o una PC sin el agente instalado).
// Nunca llama a window.print(): la aplicación debe imprimir sin confirmaciones.
export async function imprimirLocal(contenido: string, impresoraDestino?: string | null): Promise<boolean> {
  ultimoErrorImpresion = "";
  try {
    const impresora = impresoraDestino?.trim() || localStorage.getItem(CLAVE_IMPRESORA);
    if (!impresora) {
      ultimoErrorImpresion = "No hay una impresora seleccionada en este dispositivo.";
      console.warn("No hay una impresora seleccionada en este dispositivo.");
      return false;
    }
    const controller = new AbortController();
    // El spooler de Windows puede tardar varios segundos si la impresora estaba en reposo.
    // No cortar prematuramente: el agente podría estar procesando correctamente el trabajo.
    const timeout = setTimeout(() => controller.abort(), 20_000);
    const res = await fetch(`${agenteImpresionUrl()}/imprimir`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ contenido, impresora }),
      signal: controller.signal,
    });
    clearTimeout(timeout);
    if (!res.ok) {
      const data = await res.json().catch(() => null);
      ultimoErrorImpresion = data?.error || `Windows respondió con error ${res.status}`;
      console.warn("Agente de impresión local respondió con error:", data?.error || res.status);
      return false;
    }
    return true;
  } catch (err) {
    ultimoErrorImpresion = err instanceof Error ? err.message : "No se pudo contactar al agente local";
    console.warn("No se pudo contactar al agente de impresión local:", err);
    return false;
  }
}

export function obtenerUltimoErrorImpresion(): string {
  return ultimoErrorImpresion;
}

export function obtenerImpresoraSeleccionada(): string {
  return typeof window === "undefined" ? "" : localStorage.getItem(CLAVE_IMPRESORA) || "";
}

export function guardarImpresoraSeleccionada(nombre: string) {
  localStorage.setItem(CLAVE_IMPRESORA, nombre);
}

export async function obtenerEstadoAgenteImpresion(): Promise<EstadoAgenteImpresion> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 5000);
  try {
    const res = await fetch(`${agenteImpresionUrl()}/health`, {
      cache: "no-store",
      signal: controller.signal,
    });
    if (!res.ok) throw new Error("El agente local no respondió correctamente");
    const data = await res.json();
    return {
      ok: data?.ok === true,
      agente: typeof data?.agente === "string" ? data.agente : "",
    };
  } finally {
    clearTimeout(timeout);
  }
}

export async function listarImpresorasLocales(): Promise<ImpresoraLocal[]> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 5000);
  try {
    const res = await fetch(`${agenteImpresionUrl()}/impresoras`, { signal: controller.signal });
    if (!res.ok) throw new Error("El agente no pudo consultar las impresoras");
    const data = await res.json();
    return Array.isArray(data.impresoras) ? data.impresoras : [];
  } finally {
    clearTimeout(timeout);
  }
}
