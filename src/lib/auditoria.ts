import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { COOKIE_SESION, verificarSesion } from "@/lib/session";

export async function obtenerUsuarioIdDesdeRequest(req: NextRequest): Promise<number | null> {
  const token = req.cookies.get(COOKIE_SESION)?.value;
  if (!token) return null;
  const sesion = await verificarSesion(token);
  if (!sesion) return null;
  return Number(sesion.sub);
}

export async function registrarAuditoria(usuarioId: number | null | undefined, accion: string, descripcion?: string) {
  if (!usuarioId) return;

  try {
    await prisma.auditoriaLog.create({
      data: {
        usuarioId,
        accion,
        descripcion: descripcion || null,
      },
    });
  } catch (err) {
    console.error("Error registering audit log:", err);
  }
}
