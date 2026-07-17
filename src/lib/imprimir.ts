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
