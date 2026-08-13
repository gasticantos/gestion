import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { sesionActual } from "@/lib/sesionServidor";
import { obtenerUsuarioIdDesdeRequest, registrarAuditoria } from "@/lib/auditoria";

export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const sesion = await sesionActual();
  if (sesion?.rol === "MOZO") {
    return NextResponse.json({ error: "No tenés permiso para mover mesas" }, { status: 403 });
  }

  const { id } = await params;
  const origenId = Number(id);
  const body = await req.json();
  const destinoId = Number(body.destinoId);

  if (!Number.isInteger(destinoId)) {
    return NextResponse.json({ error: "Elegí la mesa de destino" }, { status: 400 });
  }
  if (destinoId === origenId) {
    return NextResponse.json({ error: "Elegí una mesa distinta" }, { status: 400 });
  }

  const [origen, destino] = await Promise.all([
    prisma.mesa.findUnique({ where: { id: origenId }, include: { ventas: { where: { estado: "ABIERTA" } } } }),
    prisma.mesa.findUnique({ where: { id: destinoId }, include: { ventas: { where: { estado: "ABIERTA" } } } }),
  ]);

  if (!origen) {
    return NextResponse.json({ error: "Mesa de origen no encontrada" }, { status: 404 });
  }
  if (!destino) {
    return NextResponse.json({ error: "Mesa de destino no encontrada" }, { status: 404 });
  }
  const venta = origen.ventas[0];
  if (!venta) {
    return NextResponse.json({ error: "Esa mesa no tiene una cuenta abierta para mover" }, { status: 409 });
  }
  if (destino.estado === "OCUPADA" || destino.ventas[0]) {
    return NextResponse.json({ error: "La mesa de destino no está libre" }, { status: 409 });
  }

  await prisma.$transaction([
    prisma.venta.update({ where: { id: venta.id }, data: { mesaId: destino.id } }),
    prisma.mesa.update({ where: { id: origen.id }, data: { estado: "LIBRE" } }),
    prisma.mesa.update({ where: { id: destino.id }, data: { estado: "OCUPADA" } }),
  ]);

  const usuarioId = await obtenerUsuarioIdDesdeRequest(req);
  const nombreOrigen = origen.apodo || origen.nombre;
  const nombreDestino = destino.apodo || destino.nombre;
  await registrarAuditoria(usuarioId, "mover_mesa", `Venta #${venta.id}: ${nombreOrigen} -> ${nombreDestino}`);

  return NextResponse.json({ success: true, destinoId: destino.id });
}
