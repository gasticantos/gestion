import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { redondearPrecio } from "@/lib/precio";

export async function GET() {
  const productos = await prisma.producto.findMany({
    select: {
      id: true,
      nombre: true,
      codigoBarras: true,
      codigoInterno: true,
      marca: true,
      categoriaId: true,
      precioVenta: true,
      precioVentaMesa: true,
      precioVentaMesaManual: true,
      precioCosto: true,
      stock: true,
      unidad: true,
      activo: true,
      updatedAt: true,
      proveedor: { select: { id: true, nombre: true } },
      categoria: { select: { id: true, nombre: true } },
    },
    orderBy: { nombre: "asc" },
  });
  return NextResponse.json(productos);
}

export async function POST(req: NextRequest) {
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
    proveedorId,
  } = body;

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
        precioVenta: redondearPrecio(Number(precioVenta)),
        precioVentaMesa: redondearPrecio(precioVentaMesa !== undefined ? Number(precioVentaMesa) : Number(precioVenta)),
        precioVentaMesaManual: Boolean(precioVentaMesaManual),
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

export async function PATCH(req: NextRequest) {
  const body = await req.json();
  const ids = Array.isArray(body.ids)
    ? body.ids.map(Number).filter((id: number) => Number.isInteger(id) && id > 0)
    : [];
  const cambios = body.cambios;

  if (ids.length === 0) {
    return NextResponse.json({ error: "Seleccioná al menos un producto" }, { status: 400 });
  }
  if (!cambios || typeof cambios !== "object" || Array.isArray(cambios)) {
    return NextResponse.json({ error: "No hay cambios para aplicar" }, { status: 400 });
  }

  const permitidos = new Set([
    "categoriaId",
    "precioCosto",
    "precioVenta",
    "precioVentaMesa",
    "precioVentaMesaManual",
    "stock",
    "unidad",
    "proveedorId",
    "activo",
  ]);
  const entradas = Object.entries(cambios).filter(([campo]) => permitidos.has(campo));
  if (entradas.length === 0 || entradas.length !== Object.keys(cambios).length) {
    return NextResponse.json({ error: "Los cambios enviados no son válidos" }, { status: 400 });
  }

  const data: Record<string, string | number | boolean | null> = {};
  for (const [campo, valor] of entradas) {
    if (campo === "categoriaId" || campo === "proveedorId") {
      if (valor !== null && (!Number.isInteger(Number(valor)) || Number(valor) <= 0)) {
        return NextResponse.json({ error: `${campo} no es válido` }, { status: 400 });
      }
      data[campo] = valor === null ? null : Number(valor);
    } else if (["precioCosto", "precioVenta", "precioVentaMesa", "stock"].includes(campo)) {
      if (valor === "" || !Number.isFinite(Number(valor))) {
        return NextResponse.json({ error: `${campo} debe ser un número` }, { status: 400 });
      }
      const numero = Number(valor);
      data[campo] = campo === "precioVenta" || campo === "precioVentaMesa"
        ? redondearPrecio(numero)
        : numero;
    } else if (campo === "unidad") {
      if (typeof valor !== "string" || !valor.trim()) {
        return NextResponse.json({ error: "La unidad no puede quedar vacía" }, { status: 400 });
      }
      data.unidad = valor.trim();
    } else {
      if (typeof valor !== "boolean") {
        return NextResponse.json({ error: `${campo} no es válido` }, { status: 400 });
      }
      data[campo] = valor;
    }
  }

  try {
    const resultado = await prisma.producto.updateMany({
      where: { id: { in: ids } },
      data,
    });
    return NextResponse.json({ actualizados: resultado.count });
  } catch {
    return NextResponse.json({ error: "No se pudieron actualizar los productos" }, { status: 500 });
  }
}
