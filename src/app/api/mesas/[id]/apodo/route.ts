import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { obtenerUsuarioIdDesdeRequest, registrarAuditoria } from "@/lib/auditoria";

export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const body = await req.json();
  const apodo = typeof body.apodo === "string" ? body.apodo.trim().slice(0, 40) : "";

  try {
    const actual = await prisma.mesa.findUnique({ where: { id: Number(id) } });
    if (!actual) {
      return NextResponse.json({ error: "Mesa no encontrada" }, { status: 404 });
    }

    const datos: { apodo: string | null; numero?: number; nombre?: string } = { apodo: apodo || null };
    // Al ponerle apodo a una mesa que todavía tenía su número "de grilla" (1, 2, 3...),
    // liberamos ese número para que una mesa nueva lo pueda volver a usar: esta mesa pasa
    // a un número interno negativo (único por id), que nunca choca con la numeración
    // normal y ya no cuenta para calcular el siguiente número al crear una mesa.
    if (apodo && actual.numero > 0) {
      datos.numero = -actual.id;
      datos.nombre = `Mesa #${actual.id}`;
    }

    const mesa = await prisma.mesa.update({
      where: { id: Number(id) },
      data: datos,
    });

    const usuarioId = await obtenerUsuarioIdDesdeRequest(req);
    await registrarAuditoria(usuarioId, "editar_apodo_mesa", `Mesa ${actual.nombre} -> apodo: "${apodo || "(sin apodo)"}"`);

    return NextResponse.json(mesa);
  } catch {
    return NextResponse.json({ error: "No se pudo actualizar el apodo" }, { status: 500 });
  }
}
