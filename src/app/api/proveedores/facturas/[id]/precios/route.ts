import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { redondearPrecio } from "@/lib/precio";
import { sesionActual } from "@/lib/sesionServidor";

export async function PATCH(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const sesion = await sesionActual();
  if (!sesion) return NextResponse.json({ error: "No autenticado" }, { status: 401 });
  if (sesion.rol === "MOZO") return NextResponse.json({ error: "No tenés permiso" }, { status: 403 });
  const { id } = await params;
  const facturaId = Number(id);

  const factura = await prisma.facturaProveedor.findFirst({
    where: { id: facturaId, negocioId: sesion.negocioId },
    include: { items: { where: { requiereAumento: true, precioActualizado: false } } },
  });
  if (!factura) return NextResponse.json({ error: "Factura inexistente" }, { status: 404 });
  if (factura.items.length === 0) return NextResponse.json({ actualizados: 0 });

  await prisma.$transaction(async (tx) => {
    for (const item of factura.items) {
      if (!item.precioVentaSugerido) continue;
      const producto = await tx.producto.findFirst({ where: { id: item.productoId, negocioId: sesion.negocioId } });
      if (!producto) continue;
      const nuevoPrecio = redondearPrecio(item.precioVentaSugerido);
      const proporcionMesa = producto.precioVenta > 0 ? producto.precioVentaMesa / producto.precioVenta : 1;
      await tx.producto.update({
        where: { id: producto.id },
        data: {
          precioVenta: nuevoPrecio,
          ...(!producto.precioVentaMesaManual ? { precioVentaMesa: redondearPrecio(nuevoPrecio * proporcionMesa) } : {}),
        },
      });
      await tx.facturaProveedorItem.update({ where: { id: item.id }, data: { precioActualizado: true } });
    }
  });
  return NextResponse.json({ actualizados: factura.items.length });
}
