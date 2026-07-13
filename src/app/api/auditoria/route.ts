import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET(req: NextRequest) {
  const limit = Number(req.nextUrl.searchParams.get("limit")) || 100;
  const offset = Number(req.nextUrl.searchParams.get("offset")) || 0;

  try {
    const logs = await prisma.auditoriaLog.findMany({
      include: { usuario: { select: { nombre: true, email: true, rol: true } } },
      orderBy: { createdAt: "desc" },
      take: limit,
      skip: offset,
    });

    const total = await prisma.auditoriaLog.count();

    return NextResponse.json({ logs, total });
  } catch (error) {
    console.error("Error fetching audit logs:", error);
    return NextResponse.json({ error: "Error al cargar auditoría" }, { status: 500 });
  }
}
