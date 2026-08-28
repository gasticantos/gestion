import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { COOKIE_SESION, firmarSesion } from "@/lib/session";
import { sesionActual } from "@/lib/sesionServidor";

export async function GET() {
  const cookieStore = await cookies();
  const sesion = await sesionActual();

  if (!sesion) {
    cookieStore.delete(COOKIE_SESION);
    return NextResponse.json({ error: "No autenticado" }, { status: 401 });
  }
  // Renueva la cookie con la identidad vigente. Un cambio de nombre o rol deja de
  // depender de que el usuario cierre sesión manualmente en cada dispositivo.
  cookieStore.set(COOKIE_SESION, await firmarSesion(sesion), {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 24 * 30,
  });
  return NextResponse.json({
    nombre: sesion.nombre,
    rol: sesion.rol,
    negocio: sesion.negocioNombre,
  });
}
