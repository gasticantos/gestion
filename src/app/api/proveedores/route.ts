import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET() {
  const proveedores = await prisma.proveedor.findMany({
    orderBy: { nombre: "asc" },
  });
  return NextResponse.json(proveedores);
}

export async function POST(req: NextRequest) {
  const body = await req.json();
  const { nombre, telefono, contacto, notas } = body;

  if (!nombre || typeof nombre !== "string") {
    return NextResponse.json({ error: "El nombre es obligatorio" }, { status: 400 });
  }

  const proveedor = await prisma.proveedor.create({
    data: { nombre, telefono: telefono || null, contacto: contacto || null, notas: notas || null },
  });
  return NextResponse.json(proveedor, { status: 201 });
}
