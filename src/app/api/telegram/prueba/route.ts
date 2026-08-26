import { NextResponse } from "next/server";
import { sesionActual } from "@/lib/sesionServidor";
import { enviarAlertaTelegram } from "@/lib/telegram";

export async function POST() {
  const sesion = await sesionActual();
  if (!sesion) return NextResponse.json({ error: "No autenticado" }, { status: 401 });
  if (sesion.rol !== "DUENIO") {
    return NextResponse.json({ error: "Solo el dueño puede probar las alertas" }, { status: 403 });
  }

  const resultado = await enviarAlertaTelegram(
    `✅ Alertas conectadas\n${sesion.negocioNombre}\nLa integración con Gestión funciona correctamente.`
  );
  if (!resultado.ok) return NextResponse.json({ error: resultado.error }, { status: 502 });
  return NextResponse.json({ success: true });
}
