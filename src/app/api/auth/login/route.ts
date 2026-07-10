import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { prisma } from "@/lib/prisma";
import { verifyPassword } from "@/lib/auth";
import { firmarSesion, COOKIE_SESION } from "@/lib/session";

export async function POST(req: NextRequest) {
  const body = await req.json();
  const { email, password } = body as { email: string; password: string };

  if (!email || !password) {
    return NextResponse.json({ error: "Ingresá email y contraseña" }, { status: 400 });
  }

  const usuario = await prisma.usuario.findUnique({ where: { email: email.toLowerCase().trim() } });
  if (!usuario || !usuario.activo || !(await verifyPassword(password, usuario.passwordHash))) {
    return NextResponse.json({ error: "Email o contraseña incorrectos" }, { status: 401 });
  }

  const token = await firmarSesion({ sub: String(usuario.id), nombre: usuario.nombre, rol: usuario.rol });

  const cookieStore = await cookies();
  cookieStore.set(COOKIE_SESION, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 24 * 30,
  });

  return NextResponse.json({ nombre: usuario.nombre, rol: usuario.rol });
}
