import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { Tarifa } from "@/lib/precio";
import { obtenerUsuarioIdDesdeRequest, registrarAuditoria } from "@/lib/auditoria";

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const body = await req.json().catch(() => ({}));
  const configuracion = await prisma.configuracion.findFirst();
  const tarifa: Tarifa =
    configuracion?.precioMesaActivo !== false && body.tarifa !== "PARTICULAR" ? "MESA" : "PARTICULAR";

  const mesaId = Number(id);
  const mesa = await prisma.mesa.findUnique({ where: { id: mesaId } });

  if (!mesa) {
    return NextResponse.json({ error: "Mesa no encontrada" }, { status: 404 });
  }
  const venta = await prisma.$transaction(async (tx) => {
    // La actualización condicional bloquea la fila: si llegan dos aperturas juntas,
    // solamente una puede pasar de LIBRE a OCUPADA y crear una cuenta.
    const ocupada = await tx.mesa.updateMany({
      where: { id: mesaId, estado: "LIBRE" },
      data: { estado: "OCUPADA" },
    });
    if (ocupada.count === 0) return null;
    return tx.venta.create({
      data: { tipo: "MESA", mesaId, estado: "ABIERTA", total: 0, tarifa },
    });
  });

  if (!venta) {
    return NextResponse.json({ error: "La mesa ya está ocupada" }, { status: 409 });
  }

  const usuarioId = await obtenerUsuarioIdDesdeRequest(req);
  await registrarAuditoria(usuarioId, "abrir_mesa", `Mesa ${mesa.nombre} (ID: ${mesa.id})`);

  return NextResponse.json(venta, { status: 201 });
}
