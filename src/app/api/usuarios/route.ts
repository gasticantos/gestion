import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { hashPassword } from "@/lib/auth";

export async function GET() {
  const usuarios = await prisma.usuario.findMany({
    select: { id: true, nombre: true, email: true, rol: true, activo: true, createdAt: true },
    orderBy: { nombre: "asc" },
  });
  return NextResponse.json(usuarios);
}

export async function POST(req: NextRequest) {
  const body = await req.json();
  const { nombre, email, password, rol } = body;

  if (!nombre || !email || !password || password.length < 6) {
    return NextResponse.json(
      { error: "Completá nombre, email y una contraseña de al menos 6 caracteres" },
      { status: 400 }
    );
  }

  try {
    const usuario = await prisma.usuario.create({
      data: {
        nombre,
        email: email.toLowerCase().trim(),
        passwordHash: await hashPassword(password),
        rol: rol || "MOZO",
      },
      select: { id: true, nombre: true, email: true, rol: true, activo: true, createdAt: true },
    });
    return NextResponse.json(usuario, { status: 201 });
  } catch {
    return NextResponse.json({ error: "Ya existe un usuario con ese email" }, { status: 409 });
  }
}
