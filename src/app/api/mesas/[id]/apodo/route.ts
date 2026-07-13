import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { obtenerUsuarioIdDesdeRequest, registrarAuditoria } from "@/lib/auditoria";

export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const body = await req.json();
  const apodo = typeof body.apodo === "string" ? body.apodo.trim().slice(0, 40) : "";

  try {
    const mesa = await prisma.mesa.update({
      where: { id: Number(id) },
      data: { apodo: apodo || null },
    });

    const usuarioId = await obtenerUsuarioIdDesdeRequest(req);
    await registrarAuditoria(usuarioId, "editar_apodo_mesa", `Mesa ${mesa.nombre} -> apodo: "${apodo || "(sin apodo)"}"`);

    return NextResponse.json(mesa);
  } catch {
    return NextResponse.json({ error: "No se pudo actualizar el apodo" }, { status: 500 });
  }
}
