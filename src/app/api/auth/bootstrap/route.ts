import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { hashPassword } from "@/lib/auth";

// Crea el primer usuario (Dueño) solo si todavía no existe ninguno. Una vez que hay
// al menos un usuario, este endpoint queda inerte para no permitir crear cuentas sin loguearse.
export async function POST(req: NextRequest) {
  const yaHayUsuarios = (await prisma.usuario.count()) > 0;
  if (yaHayUsuarios) {
    return NextResponse.json({ error: "Ya hay usuarios creados" }, { status: 403 });
  }

  const body = await req.json();
  const { nombre, email, password } = body as { nombre: string; email: string; password: string };

  if (!nombre || !email || !password || password.length < 6) {
    return NextResponse.json(
      { error: "Completá nombre, email y una contraseña de al menos 6 caracteres" },
      { status: 400 }
    );
  }

  const usuario = await prisma.usuario.create({
    data: {
      nombre,
      email: email.toLowerCase().trim(),
      passwordHash: await hashPassword(password),
      rol: "DUENIO",
    },
  });

  return NextResponse.json({ id: usuario.id }, { status: 201 });
}

export async function GET() {
  const yaHayUsuarios = (await prisma.usuario.count()) > 0;
  return NextResponse.json({ requiereBootstrap: !yaHayUsuarios });
}
