import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { redondearPrecio } from "@/lib/precio";
import { sesionActual } from "@/lib/sesionServidor";

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
  const sesion = await sesionActual();
  if (!sesion || sesion.rol === "MOZO") {
    return NextResponse.json({ error: "No tenés permiso para crear productos" }, { status: 403 });
  }
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
    const configuracion = await prisma.configuracion.findFirst();
    const precioMesaHabilitado = configuracion?.precioMesaActivo !== false;
    const precioVentaRedondeado = redondearPrecio(Number(precioVenta));
    const producto = await prisma.producto.create({
      data: {
        nombre,
        codigoBarras: codigoBarras || null,
        categoriaId: categoriaId ? Number(categoriaId) : null,
        precioVenta: precioVentaRedondeado,
        precioVentaMesa: precioMesaHabilitado
          ? redondearPrecio(precioVentaMesa !== undefined ? Number(precioVentaMesa) : Number(precioVenta))
          : precioVentaRedondeado,
        precioVentaMesaManual: precioMesaHabilitado && Boolean(precioVentaMesaManual),
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
  const sesion = await sesionActual();
  if (!sesion || sesion.rol === "MOZO") {
    return NextResponse.json({ error: "No tenés permiso para editar productos" }, { status: 403 });
  }
  const body = await req.json();
  type ActualizacionProducto = {
    id: unknown;
    nombre: unknown;
    codigoBarras: unknown;
    categoriaId: unknown;
    precioCosto: unknown;
    precioVenta: unknown;
    precioVentaMesa: unknown;
    precioVentaMesaManual: unknown;
    stock: unknown;
    unidad: unknown;
    proveedorId: unknown;
  };
  const actualizaciones: ActualizacionProducto[] = Array.isArray(body.actualizaciones)
    ? body.actualizaciones
    : [];
  if (actualizaciones.length === 0) {
    return NextResponse.json({ error: "No hay productos para actualizar" }, { status: 400 });
  }

  for (const item of actualizaciones) {
    if (
      !Number.isInteger(Number(item.id)) ||
      !String(item.nombre || "").trim() ||
      !String(item.unidad || "").trim() ||
      [item.precioCosto, item.precioVenta, item.precioVentaMesa, item.stock].some(
        (valor) => valor === "" || !Number.isFinite(Number(valor))
      )
    ) {
      return NextResponse.json({ error: "Revisá los datos de las filas editadas" }, { status: 400 });
    }
  }

  try {
    const configuracion = await prisma.configuracion.findFirst();
    const precioMesaHabilitado = configuracion?.precioMesaActivo !== false;
    await prisma.$transaction(
      actualizaciones.map((item) =>
        prisma.producto.update({
          where: { id: Number(item.id) },
          data: {
            nombre: String(item.nombre).trim(),
            codigoBarras: item.codigoBarras ? String(item.codigoBarras).trim() : null,
            categoriaId: item.categoriaId ? Number(item.categoriaId) : null,
            precioCosto: Number(item.precioCosto),
            precioVenta: redondearPrecio(Number(item.precioVenta)),
            precioVentaMesa: precioMesaHabilitado
              ? redondearPrecio(Number(item.precioVentaMesa))
              : redondearPrecio(Number(item.precioVenta)),
            precioVentaMesaManual: precioMesaHabilitado && Boolean(item.precioVentaMesaManual),
            stock: Number(item.stock),
            unidad: String(item.unidad).trim(),
            proveedorId: item.proveedorId ? Number(item.proveedorId) : null,
          },
        })
      )
    );
    return NextResponse.json({ actualizados: actualizaciones.length });
  } catch (err: unknown) {
    if (typeof err === "object" && err !== null && "code" in err && err.code === "P2002") {
      return NextResponse.json({ error: "Hay un código de barras repetido" }, { status: 409 });
    }
    return NextResponse.json({ error: "No se pudieron actualizar los productos" }, { status: 500 });
  }
}
