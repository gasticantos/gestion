import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { redondearPrecio } from "@/lib/precio";
import { sesionActual } from "@/lib/sesionServidor";

export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const sesion = await sesionActual();
  if (!sesion || sesion.rol === "MOZO") {
    return NextResponse.json({ error: "No tenés permiso para editar productos" }, { status: 403 });
  }
  const { id } = await params;
  const body = await req.json();
  const {
    nombre,
    codigoBarras,
    categoriaId,
    precioVenta,
    precioVentaMesa,
    precioVentaMesaManual,
    precioCosto,
    stock,
    unidad,
    impresora,
    proveedorId,
    activo,
  } = body;
  const configuracion = await prisma.configuracion.findFirst();
  const precioMesaHabilitado = configuracion?.precioMesaActivo !== false;
  const precioVentaFinal =
    precioVenta !== undefined ? redondearPrecio(Number(precioVenta)) : undefined;

  try {
    const producto = await prisma.producto.update({
      where: { id: Number(id) },
      data: {
        nombre,
        codigoBarras: codigoBarras || null,
        categoriaId: categoriaId ? Number(categoriaId) : null,
        precioVenta: precioVentaFinal,
        precioVentaMesa: precioMesaHabilitado
          ? precioVentaMesa !== undefined
            ? redondearPrecio(Number(precioVentaMesa))
            : undefined
          : precioVentaFinal,
        precioVentaMesaManual: precioMesaHabilitado
          ? precioVentaMesaManual !== undefined
            ? Boolean(precioVentaMesaManual)
            : undefined
          : false,
        precioCosto: precioCosto !== undefined ? Number(precioCosto) : undefined,
        stock: stock !== undefined ? Number(stock) : undefined,
        unidad,
        impresora: impresora !== undefined ? (impresora ? String(impresora).trim() : null) : undefined,
        proveedorId: proveedorId ? Number(proveedorId) : null,
        activo,
      },
    });
    return NextResponse.json(producto);
  } catch (err: unknown) {
    if (typeof err === "object" && err !== null && "code" in err && err.code === "P2002") {
      return NextResponse.json({ error: "Ya existe un producto con ese código de barras" }, { status: 409 });
    }
    return NextResponse.json({ error: "No se pudo actualizar el producto" }, { status: 500 });
  }
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const sesion = await sesionActual();
  if (!sesion || sesion.rol === "MOZO") {
    return NextResponse.json({ error: "No tenés permiso para eliminar productos" }, { status: 403 });
  }
  const { id } = await params;
  // Baja lógica en vez de borrado físico: preserva historial de ventas/stock ya registrado.
  const producto = await prisma.producto.update({
    where: { id: Number(id) },
    data: { activo: false },
  });
  return NextResponse.json(producto);
}
