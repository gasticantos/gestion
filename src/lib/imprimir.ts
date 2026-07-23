// Puerto donde escucha el agente local de impresión (ver /print-agent en la raíz del repo).
// Corre en la PC de la caja y manda el ticket directo a la impresora por USB, sin pasar por
// el navegador: así no aparece ningún diálogo de confirmación de impresión.
const AGENTE_IMPRESION_URL = "http://127.0.0.1:9847";

export const ERROR_IMPRESION_LOCAL =
  "No se pudo imprimir automáticamente. Verificá que el agente de impresión esté iniciado y que la impresora esté encendida. No se abrió el diálogo del navegador.";

// Intenta imprimir a través del agente local. Devuelve true si lo logró; false si el agente
// no está corriendo en esta máquina (por ejemplo, un celular o una PC sin el agente instalado).
// Nunca llama a window.print(): la aplicación debe imprimir sin confirmaciones.
export async function imprimirLocal(contenido: string): Promise<boolean> {
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 1500);
    const res = await fetch(`${AGENTE_IMPRESION_URL}/imprimir`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ contenido }),
      signal: controller.signal,
    });
    clearTimeout(timeout);
    if (!res.ok) {
      const data = await res.json().catch(() => null);
      console.warn("Agente de impresión local respondió con error:", data?.error || res.status);
      return false;
    }
    return true;
  } catch (err) {
    console.warn("No se pudo contactar al agente de impresión local:", err);
    return false;
  }
}
