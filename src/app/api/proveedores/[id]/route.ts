import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { sesionActual } from "@/lib/sesionServidor";

export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const sesion = await sesionActual();
  if (!sesion) return NextResponse.json({ error: "No autenticado" }, { status: 401 });
  if (sesion.rol === "MOZO") return NextResponse.json({ error: "No tenés permiso" }, { status: 403 });
  const { id } = await params;
  const body = await req.json();
  const { nombre, telefono, contacto, notas, activo } = body;

  const existente = await prisma.proveedor.findFirst({ where: { id: Number(id), negocioId: sesion.negocioId } });
  if (!existente) return NextResponse.json({ error: "Proveedor inexistente" }, { status: 404 });
  const proveedor = await prisma.proveedor.update({
    where: { id: existente.id },
    data: { nombre, telefono: telefono || null, contacto: contacto || null, notas: notas || null, activo },
  });
  return NextResponse.json(proveedor);
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const sesion = await sesionActual();
  if (!sesion) return NextResponse.json({ error: "No autenticado" }, { status: 401 });
  if (sesion.rol === "MOZO") return NextResponse.json({ error: "No tenés permiso" }, { status: 403 });
  const { id } = await params;
  const existente = await prisma.proveedor.findFirst({ where: { id: Number(id), negocioId: sesion.negocioId } });
  if (!existente) return NextResponse.json({ error: "Proveedor inexistente" }, { status: 404 });
  const proveedor = await prisma.proveedor.update({
    where: { id: existente.id },
    data: { activo: false },
  });
  return NextResponse.json(proveedor);
}
