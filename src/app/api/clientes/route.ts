import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET() {
  const clientes = await prisma.cliente.findMany({
    orderBy: { nombre: "asc" },
  });
  return NextResponse.json(clientes);
}

export async function POST(req: NextRequest) {
  const body = await req.json();
  const { nombre, telefono } = body;

  if (!nombre || typeof nombre !== "string") {
    return NextResponse.json({ error: "El nombre es obligatorio" }, { status: 400 });
  }

  const cliente = await prisma.cliente.create({
    data: { nombre, telefono: telefono || null },
  });
  return NextResponse.json(cliente, { status: 201 });
}
