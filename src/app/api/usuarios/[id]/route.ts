import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { hashPassword } from "@/lib/auth";

export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const body = await req.json();
  const { nombre, email, password, rol, activo } = body;

  try {
    const usuario = await prisma.usuario.update({
      where: { id: Number(id) },
      data: {
        nombre,
        email: email ? String(email).toLowerCase().trim() : undefined,
        rol,
        activo,
        ...(password ? { passwordHash: await hashPassword(password) } : {}),
      },
      select: { id: true, nombre: true, email: true, rol: true, activo: true, createdAt: true },
    });
    return NextResponse.json(usuario);
  } catch {
    return NextResponse.json({ error: "Ya existe un usuario con ese email" }, { status: 409 });
  }
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const usuario = await prisma.usuario.update({
    where: { id: Number(id) },
    data: { activo: false },
    select: { id: true, nombre: true, email: true, rol: true, activo: true, createdAt: true },
  });
  return NextResponse.json(usuario);
}
