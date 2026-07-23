// Puerto donde escucha el agente local de impresión (ver /print-agent en la raíz del repo).
// Corre en la PC de la caja y manda el ticket directo a la impresora por USB, sin pasar por
// el navegador: así no aparece ningún diálogo de confirmación de impresión.
const AGENTE_IMPRESION_URL = "http://127.0.0.1:9847";

// Intenta imprimir a través del agente local. Devuelve true si lo logró; false si el agente
// no está corriendo en esta máquina (por ejemplo, un celular o una PC sin el agente instalado),
// para que el llamador recurra al diálogo de impresión del navegador como respaldo.
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
    return res.ok;
  } catch {
    return false;
  }
}

// Carga una página de ticket/comanda en un iframe invisible (en vez de abrir una pestaña nueva)
// y deja que su propio AutoPrint dispare window.print() adentro de ese iframe. El usuario nunca
// ve una pestaña nueva ni navega a ningún lado: el ticket se imprime "en segundo plano" sobre la
// pantalla en la que ya está trabajando.
export function imprimirEnSegundoPlano(url: string) {
  const iframe = document.createElement("iframe");
  iframe.style.position = "absolute";
  iframe.style.left = "-9999px";
  iframe.style.width = "1px";
  iframe.style.height = "1px";
  iframe.src = url;
  document.body.appendChild(iframe);

  // Lo sacamos del DOM pasado un rato: le da tiempo a la página a cargar, auto-imprimirse,
  // y a que el usuario confirme el diálogo del navegador antes de limpiarlo.
  setTimeout(() => iframe.remove(), 20000);
}
