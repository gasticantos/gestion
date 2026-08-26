type ResultadoTelegram =
  | { ok: true }
  | { ok: false; error: string };

/** Envía una alerta sin propagar errores: Telegram nunca debe bloquear la operación del negocio. */
export async function enviarAlertaTelegram(texto: string): Promise<ResultadoTelegram> {
  const token = process.env.TELEGRAM_BOT_TOKEN?.trim();
  const chatId = process.env.TELEGRAM_CHAT_ID?.trim();
  if (!token || !chatId) return { ok: false, error: "Telegram no está configurado" };

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 5_000);
  try {
    const res = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ chat_id: chatId, text: texto }),
      signal: controller.signal,
      cache: "no-store",
    });
    const data = await res.json().catch(() => null);
    if (!res.ok || data?.ok !== true) {
      return { ok: false, error: data?.description || "Telegram rechazó el mensaje" };
    }
    return { ok: true };
  } catch (error) {
    return {
      ok: false,
      error: error instanceof Error ? error.message : "No se pudo contactar a Telegram",
    };
  } finally {
    clearTimeout(timeout);
  }
}

export async function enviarDocumentoTelegram(
  archivo: ArrayBuffer,
  nombreArchivo: string,
  descripcion: string
): Promise<ResultadoTelegram> {
  const token = process.env.TELEGRAM_BOT_TOKEN?.trim();
  const chatId = process.env.TELEGRAM_CHAT_ID?.trim();
  if (!token || !chatId) return { ok: false, error: "Telegram no está configurado" };

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 12_000);
  try {
    const formulario = new FormData();
    formulario.set("chat_id", chatId);
    formulario.set("caption", descripcion);
    formulario.set("document", new Blob([archivo], { type: "application/pdf" }), nombreArchivo);
    const res = await fetch(`https://api.telegram.org/bot${token}/sendDocument`, {
      method: "POST",
      body: formulario,
      signal: controller.signal,
      cache: "no-store",
    });
    const data = await res.json().catch(() => null);
    if (!res.ok || data?.ok !== true) {
      return { ok: false, error: data?.description || "Telegram rechazó el PDF" };
    }
    return { ok: true };
  } catch (error) {
    return {
      ok: false,
      error: error instanceof Error ? error.message : "No se pudo enviar el PDF a Telegram",
    };
  } finally {
    clearTimeout(timeout);
  }
}
