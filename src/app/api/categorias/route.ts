import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET() {
  const categorias = await prisma.categoria.findMany({
    orderBy: { nombre: "asc" },
  });
  return NextResponse.json(categorias);
}

export async function POST(req: NextRequest) {
  const body = await req.json();
  const { nombre } = body;

  if (!nombre || typeof nombre !== "string") {
    return NextResponse.json({ error: "El nombre es obligatorio" }, { status: 400 });
  }

  try {
    const categoria = await prisma.categoria.create({ data: { nombre } });
    return NextResponse.json(categoria, { status: 201 });
  } catch {
    return NextResponse.json({ error: "Ya existe una categoría con ese nombre" }, { status: 409 });
  }
}
