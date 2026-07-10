import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { COOKIE_SESION, verificarSesion } from "@/lib/session";

export async function GET() {
  const cookieStore = await cookies();
  const token = cookieStore.get(COOKIE_SESION)?.value;
  const sesion = token ? await verificarSesion(token) : null;

  if (!sesion) {
    return NextResponse.json({ error: "No autenticado" }, { status: 401 });
  }
  return NextResponse.json({ nombre: sesion.nombre, rol: sesion.rol });
}
