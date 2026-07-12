import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { COOKIE_SESION } from "@/lib/session";

export async function POST() {
  const cookieStore = await cookies();
  cookieStore.delete(COOKIE_SESION);

  // Respuesta con headers para limpiar cache
  const response = NextResponse.json({ ok: true });
  response.headers.set("Cache-Control", "no-store, no-cache, must-revalidate");
  response.headers.set("Pragma", "no-cache");

  return response;
}
