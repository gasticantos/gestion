import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET() {
  const productos = await prisma.producto.findMany({
    include: { proveedor: true, categoria: true },
    orderBy: { nombre: "asc" },
  });
  return NextResponse.json(productos);
}

export async function POST(req: NextRequest) {
  const body = await req.json();
  const { nombre, codigoBarras, categoriaId, precioVenta, precioCosto, stock, unidad, proveedorId } = body;

  if (!nombre || typeof nombre !== "string") {
    return NextResponse.json({ error: "El nombre es obligatorio" }, { status: 400 });
  }
  if (precioVenta === undefined || isNaN(Number(precioVenta))) {
    return NextResponse.json({ error: "El precio de venta es obligatorio" }, { status: 400 });
  }

  try {
    const producto = await prisma.producto.create({
      data: {
        nombre,
        codigoBarras: codigoBarras || null,
        categoriaId: categoriaId ? Number(categoriaId) : null,
        precioVenta: Number(precioVenta),
        precioCosto: precioCosto ? Number(precioCosto) : 0,
        stock: stock ? Number(stock) : 0,
        unidad: unidad || "unidad",
        proveedorId: proveedorId ? Number(proveedorId) : null,
      },
    });
    return NextResponse.json(producto, { status: 201 });
  } catch (err: unknown) {
    if (typeof err === "object" && err !== null && "code" in err && err.code === "P2002") {
      return NextResponse.json({ error: "Ya existe un producto con ese código de barras" }, { status: 409 });
    }
    return NextResponse.json({ error: "No se pudo crear el producto" }, { status: 500 });
  }
}
