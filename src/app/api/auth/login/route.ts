import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { prisma } from "@/lib/prisma";
import { verifyPassword } from "@/lib/auth";
import { firmarSesion, COOKIE_SESION } from "@/lib/session";
import { autenticarSupabase } from "@/lib/supabaseAuth";
import { hashPassword } from "@/lib/auth";

export async function POST(req: NextRequest) {
  const body = await req.json();
  const { email, password } = body as { email: string; password: string };

  if (!email || !password) {
    return NextResponse.json({ error: "Ingresá email y contraseña" }, { status: 400 });
  }

  const emailNormalizado = email.toLowerCase().trim();
  const usuarioAuth = await autenticarSupabase(emailNormalizado, password).catch(() => null);
  let usuario = await prisma.usuario.findUnique({
    where: { email: emailNormalizado },
    include: { negocio: true },
  });

  if (usuarioAuth && !usuario) {
    const metadata = usuarioAuth.user_metadata || {};
    const nombre = String(metadata.nombre || metadata.name || emailNormalizado.split("@")[0]);
    const negocioNombre = String(metadata.negocio_nombre || metadata.business_name || nombre);
    usuario = await prisma.$transaction(async (tx) => {
      const negocio = await tx.negocio.create({ data: { nombre: negocioNombre } });
      return tx.usuario.create({
        data: {
          nombre,
          email: emailNormalizado,
          authId: usuarioAuth.id,
          passwordHash: await hashPassword(crypto.randomUUID()),
          rol: "DUENIO",
          negocioId: negocio.id,
        },
        include: { negocio: true },
      });
    });
  } else if (usuarioAuth && usuario && !usuario.authId) {
    usuario = await prisma.usuario.update({
      where: { id: usuario.id },
      data: { authId: usuarioAuth.id },
      include: { negocio: true },
    });
  }

  const accesoLegacy = usuario && (await verifyPassword(password, usuario.passwordHash));
  if (!usuario || !usuario.activo || !usuario.negocio.activo || (!usuarioAuth && !accesoLegacy)) {
    return NextResponse.json({ error: "Email o contraseña incorrectos" }, { status: 401 });
  }

  const token = await firmarSesion({
    sub: String(usuario.id),
    nombre: usuario.nombre,
    rol: usuario.rol,
    negocioId: usuario.negocioId,
    negocioNombre: usuario.negocio.nombre,
  });

  const cookieStore = await cookies();
  cookieStore.set(COOKIE_SESION, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 24 * 30,
  });

  return NextResponse.json({ nombre: usuario.nombre, rol: usuario.rol, negocio: usuario.negocio.nombre });
}
