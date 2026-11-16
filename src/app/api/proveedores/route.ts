import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { sesionActual } from "@/lib/sesionServidor";

export async function GET() {
  const sesion = await sesionActual();
  if (!sesion) return NextResponse.json({ error: "No autenticado" }, { status: 401 });
  const proveedores = await prisma.proveedor.findMany({
    where: { negocioId: sesion.negocioId },
    orderBy: { nombre: "asc" },
  });
  return NextResponse.json(proveedores);
}

export async function POST(req: NextRequest) {
  const sesion = await sesionActual();
  if (!sesion) return NextResponse.json({ error: "No autenticado" }, { status: 401 });
  if (sesion.rol === "MOZO") return NextResponse.json({ error: "No tenés permiso" }, { status: 403 });
  const body = await req.json();
  const { nombre, telefono, contacto, notas } = body;

  if (!nombre || typeof nombre !== "string") {
    return NextResponse.json({ error: "El nombre es obligatorio" }, { status: 400 });
  }

  const proveedor = await prisma.proveedor.create({
    data: { nombre: nombre.trim(), telefono: telefono || null, contacto: contacto || null, notas: notas || null, negocioId: sesion.negocioId },
  });
  return NextResponse.json(proveedor, { status: 201 });
}
