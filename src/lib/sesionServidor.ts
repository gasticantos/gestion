import { cookies } from "next/headers";
import { COOKIE_SESION, verificarSesion } from "@/lib/session";

export async function sesionActual() {
  const cookieStore = await cookies();
  const token = cookieStore.get(COOKIE_SESION)?.value;
  return token ? verificarSesion(token) : null;
}
