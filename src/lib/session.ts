import { SignJWT, jwtVerify } from "jose";
import { Rol } from "@/generated/prisma/enums";

export const COOKIE_SESION = "sesion";

export type SesionPayload = {
  sub: string;
  nombre: string;
  rol: Rol;
  negocioId: number;
  negocioNombre: string;
};

function secretKey() {
  const secret = process.env.AUTH_SECRET;
  if (!secret) throw new Error("Falta configurar AUTH_SECRET");
  return new TextEncoder().encode(secret);
}

export async function firmarSesion(payload: SesionPayload) {
  return new SignJWT(payload)
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime("30d")
    .sign(secretKey());
}

export async function verificarSesion(token: string): Promise<SesionPayload | null> {
  try {
    const { payload } = await jwtVerify(token, secretKey());
    const sesion = payload as unknown as SesionPayload;
    if (!sesion.negocioId || !sesion.negocioNombre) return null;
    return sesion;
  } catch {
    return null;
  }
}
