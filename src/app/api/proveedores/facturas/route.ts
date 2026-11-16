import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { redondearPrecio } from "@/lib/precio";
import { sesionActual } from "@/lib/sesionServidor";

const MAX_COMPROBANTE = 4_500_000;
type ItemInput = { productoId: unknown; cantidad: unknown; costoUnitario: unknown };

export async function GET() {
  const sesion = await sesionActual();
  if (!sesion) return NextResponse.json({ error: "No autenticado" }, { status: 401 });

  const [facturas, proveedores] = await Promise.all([
    prisma.facturaProveedor.findMany({
      where: { negocioId: sesion.negocioId },
      include: {
        proveedor: { select: { id: true, nombre: true } },
        items: { orderBy: { id: "asc" } },
        pagos: { orderBy: { createdAt: "desc" } },
      },
      orderBy: [{ fecha: "desc" }, { id: "desc" }],
      take: 100,
    }),
    prisma.proveedor.findMany({
      where: { negocioId: sesion.negocioId, activo: true },
      select: { id: true, nombre: true, facturas: { where: { saldo: { gt: 0 } }, select: { saldo: true } } },
      orderBy: { nombre: "asc" },
    }),
  ]);

  return NextResponse.json({
    facturas,
    deudas: proveedores.map(({ facturas: pendientes, ...proveedor }) => ({
      ...proveedor,
      deuda: pendientes.reduce((total, factura) => total + factura.saldo, 0),
    })),
  });
}

export async function POST(req: NextRequest) {
  const sesion = await sesionActual();
  if (!sesion) return NextResponse.json({ error: "No autenticado" }, { status: 401 });
  if (sesion.rol === "MOZO") return NextResponse.json({ error: "No tenés permiso" }, { status: 403 });

  const body = await req.json().catch(() => null);
  const proveedorId = Number(body?.proveedorId);
  const items: ItemInput[] = Array.isArray(body?.items) ? body.items : [];
  const pagada = body?.estado === "PAGADA";
  const comprobante = typeof body?.comprobante === "string" ? body.comprobante : null;

  if (!Number.isInteger(proveedorId) || items.length === 0) {
    return NextResponse.json({ error: "Elegí un proveedor y agregá productos" }, { status: 400 });
  }
  if (
    comprobante &&
    (!/^data:image\/(webp|jpeg|png);base64,/.test(comprobante) || comprobante.length > MAX_COMPROBANTE)
  ) {
    return NextResponse.json({ error: "La foto no es válida o supera el tamaño permitido" }, { status: 400 });
  }

  const normalizados = items.map((item) => ({
    productoId: Number(item.productoId),
    cantidad: Number(item.cantidad),
    costoUnitario: Number(item.costoUnitario),
  }));
  if (
    normalizados.some(
      (item) => !Number.isInteger(item.productoId) || !Number.isFinite(item.cantidad) || item.cantidad <= 0 ||
        !Number.isFinite(item.costoUnitario) || item.costoUnitario < 0
    )
  ) {
    return NextResponse.json({ error: "Revisá las cantidades y costos de la factura" }, { status: 400 });
  }

  const fechaTexto = typeof body?.fecha === "string" ? body.fecha : "";
  const fecha = /^\d{4}-\d{2}-\d{2}$/.test(fechaTexto)
    ? new Date(`${fechaTexto}T12:00:00-03:00`)
    : new Date();

  try {
    const resultado = await prisma.$transaction(async (tx) => {
      const proveedor = await tx.proveedor.findFirst({ where: { id: proveedorId, negocioId: sesion.negocioId, activo: true } });
      if (!proveedor) throw new Error("PROVEEDOR_INVALIDO");

      const productos = await tx.producto.findMany({
        where: { id: { in: normalizados.map((item) => item.productoId) }, negocioId: sesion.negocioId, activo: true },
      });
      if (productos.length !== new Set(normalizados.map((item) => item.productoId)).size) throw new Error("PRODUCTO_INVALIDO");

      const configuracion = await tx.configuracion.findUnique({ where: { negocioId: sesion.negocioId } });
      const margenBase = Math.max(0, configuracion?.margenVentaBasePct ?? 30);
      const total = normalizados.reduce((suma, item) => suma + item.cantidad * item.costoUnitario, 0);
      const detalles = normalizados.map((item) => {
        const producto = productos.find((p) => p.id === item.productoId)!;
        const multiplicador = producto.precioCosto > 0 && producto.precioVenta > 0
          ? producto.precioVenta / producto.precioCosto
          : 1 + margenBase / 100;
        const sugerido = redondearPrecio(item.costoUnitario * multiplicador);
        return {
          productoId: producto.id,
          productoNombre: producto.nombre,
          cantidad: item.cantidad,
          costoAnterior: producto.precioCosto,
          costoUnitario: item.costoUnitario,
          precioVentaAnterior: producto.precioVenta,
          precioVentaSugerido: sugerido > producto.precioVenta ? sugerido : null,
          requiereAumento: item.costoUnitario > producto.precioCosto && sugerido > producto.precioVenta,
        };
      });

      const factura = await tx.facturaProveedor.create({
        data: {
          proveedorId,
          numero: String(body?.numero || "").trim() || null,
          fecha,
          total,
          saldo: pagada ? 0 : total,
          estado: pagada ? "PAGADA" : "CUENTA_CORRIENTE",
          comprobante,
          notas: String(body?.notas || "").trim() || null,
          negocioId: sesion.negocioId,
          items: { create: detalles },
          ...(pagada && total > 0 ? {
            pagos: { create: { proveedorId, monto: total, notas: "Pago registrado al cargar la factura", negocioId: sesion.negocioId } },
          } : {}),
        },
        include: { items: true },
      });

      await tx.stockEntry.create({
        data: {
          proveedorId,
          tipo: "ENTRADA",
          notas: `Factura ${factura.numero || `#${factura.id}`}`,
          negocioId: sesion.negocioId,
          items: { create: normalizados },
        },
      });
      for (const item of normalizados) {
        await tx.producto.update({
          where: { id: item.productoId },
          data: { stock: { increment: item.cantidad }, precioCosto: item.costoUnitario, proveedorId },
        });
      }
      return factura;
    });

    return NextResponse.json(resultado, { status: 201 });
  } catch (error) {
    if (error instanceof Error && error.message === "PROVEEDOR_INVALIDO") {
      return NextResponse.json({ error: "El proveedor no es válido" }, { status: 400 });
    }
    if (error instanceof Error && error.message === "PRODUCTO_INVALIDO") {
      return NextResponse.json({ error: "Uno de los productos no es válido" }, { status: 400 });
    }
    return NextResponse.json({ error: "No se pudo guardar la factura" }, { status: 500 });
  }
}
