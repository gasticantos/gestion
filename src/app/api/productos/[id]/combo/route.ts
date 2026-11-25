import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { sesionActual } from "@/lib/sesionServidor";
import { ErrorCombo, guardarComponentes, leerComponentes } from "@/lib/stockCombo";

// Reemplaza los artículos que forman un combo. Mandar una lista vacía lo vuelve un producto común.
export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const sesion = await sesionActual();
  if (!sesion || sesion.rol === "MOZO") {
    return NextResponse.json({ error: "No tenés permiso para editar productos" }, { status: 403 });
  }
  const { id } = await params;
  const comboId = Number(id);
  const body = await req.json().catch(() => ({}));
  const componentes = leerComponentes(body.combo);
  if (typeof componentes === "string") {
    return NextResponse.json({ error: componentes }, { status: 400 });
  }

  const producto = await prisma.producto.findFirst({ where: { id: comboId }, select: { id: true } });
  if (!producto) return NextResponse.json({ error: "Producto no encontrado" }, { status: 404 });

  try {
    await prisma.$transaction(async (tx) => {
      const error = await guardarComponentes(tx, comboId, componentes);
      if (error) throw new ErrorCombo(error);
      // Un combo no tiene stock propio: lo que se vende sale del stock de sus artículos.
      if (componentes.length > 0) await tx.producto.update({ where: { id: comboId }, data: { stock: 0 } });
    });
    return NextResponse.json({ ok: true });
  } catch (err) {
    if (err instanceof ErrorCombo) return NextResponse.json({ error: err.message }, { status: 400 });
    return NextResponse.json({ error: "No se pudo guardar el combo" }, { status: 500 });
  }
}
