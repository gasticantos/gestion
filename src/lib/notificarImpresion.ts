const TOPICO_IMPRESION = "gestion-impresion";

// El mensaje no incluye negocio, impresora ni contenido: solamente despierta a las
// estaciones conectadas. La API de cola sigue siendo quien autoriza y entrega el trabajo.
export async function notificarNuevaImpresion() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const clave = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !clave) return;

  try {
    const respuesta = await fetch(`${url}/realtime/v1/api/broadcast`, {
      method: "POST",
      headers: {
        apikey: clave,
        Authorization: `Bearer ${clave}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        messages: [
          {
            topic: TOPICO_IMPRESION,
            event: "nueva_impresion",
            payload: {},
            private: false,
          },
        ],
      }),
      cache: "no-store",
    });
    if (!respuesta.ok) {
      console.warn("Supabase Realtime no pudo avisar una impresión:", respuesta.status);
    }
  } catch (error) {
    // La cola persistente es la fuente de verdad. Si Realtime falla, el sondeo de respaldo
    // encuentra el trabajo; nunca hacemos fallar una venta por un aviso instantáneo.
    console.warn("No se pudo enviar el aviso Realtime de impresión:", error);
  }
}
