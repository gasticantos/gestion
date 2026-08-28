import { cookies } from "next/headers";
import { COOKIE_SESION, verificarSesion } from "@/lib/session";
import { prisma } from "@/lib/prisma";

export async function sesionActual() {
  const cookieStore = await cookies();
  const token = cookieStore.get(COOKIE_SESION)?.value;
  const sesionToken = token ? await verificarSesion(token) : null;
  if (!sesionToken) return null;

  const usuario = await prisma.usuario.findFirst({
    where: { id: Number(sesionToken.sub), activo: true, negocio: { activo: true } },
    select: {
      id: true,
      nombre: true,
      rol: true,
      negocioId: true,
      negocio: { select: { nombre: true } },
    },
  });
  if (!usuario) return null;

  return {
    sub: String(usuario.id),
    nombre: usuario.nombre,
    rol: usuario.rol,
    negocioId: usuario.negocioId,
    negocioNombre: usuario.negocio.nombre,
  };
}
