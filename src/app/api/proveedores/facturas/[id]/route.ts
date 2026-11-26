import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { redondearPrecio } from "@/lib/precio";
import { sesionActual } from "@/lib/sesionServidor";
import { calcularCostoConImpuestos, normalizarImpuestos } from "@/lib/impuestosFactura";

const MAX_COMPROBANTE = 4_500_000;
type ItemInput = { productoId: unknown; cantidad: unknown; costoBase?: unknown; costoUnitario?: unknown; impuestos?: unknown };

export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const sesion = await sesionActual();
  if (!sesion) return NextResponse.json({ error: "No autenticado" }, { status: 401 });
  if (sesion.rol === "MOZO") return NextResponse.json({ error: "No tenés permiso" }, { status: 403 });

  const { id } = await params;
  const facturaId = Number(id);
  const body = await req.json().catch(() => null);
  const proveedorId = Number(body?.proveedorId);
  const items: ItemInput[] = Array.isArray(body?.items) ? body.items : [];
  const comprobante = typeof body?.comprobante === "string" ? body.comprobante : null;
  if (!Number.isInteger(facturaId) || !Number.isInteger(proveedorId) || items.length === 0) {
    return NextResponse.json({ error: "Elegí un proveedor y agregá productos" }, { status: 400 });
  }
  if (comprobante && (!/^data:image\/(webp|jpeg|png);base64,/.test(comprobante) || comprobante.length > MAX_COMPROBANTE)) {
    return NextResponse.json({ error: "La foto no es válida o supera el tamaño permitido" }, { status: 400 });
  }

  const normalizados = items.map((item) => {
    const costoBase = Number(item.costoBase ?? item.costoUnitario);
    // Los impuestos se cargan para toda la factura; si no vienen, se usan los de cada producto (versión anterior).
    const impuestos = normalizarImpuestos(body?.impuestos !== undefined ? body.impuestos : item.impuestos);
    return { productoId: Number(item.productoId), cantidad: Number(item.cantidad), costoBase, impuestos, costoUnitario: impuestos ? calcularCostoConImpuestos(costoBase, impuestos) : NaN };
  });
  const ids = normalizados.map((item) => item.productoId);
  if (new Set(ids).size !== ids.length || normalizados.some((item) => !Number.isInteger(item.productoId) || !Number.isFinite(item.cantidad) || item.cantidad <= 0 || !item.impuestos || !Number.isFinite(item.costoBase) || item.costoBase < 0 || !Number.isFinite(item.costoUnitario))) {
    return NextResponse.json({ error: "Revisá los productos, cantidades y costos de la factura" }, { status: 400 });
  }
  const fechaTexto = typeof body?.fecha === "string" ? body.fecha : "";
  if (!/^\d{4}-\d{2}-\d{2}$/.test(fechaTexto)) return NextResponse.json({ error: "La fecha no es válida" }, { status: 400 });
  const fecha = new Date(`${fechaTexto}T12:00:00-03:00`);

  try {
    const resultado = await prisma.$transaction(async (tx) => {
      const factura = await tx.facturaProveedor.findFirst({
        where: { id: facturaId, negocioId: sesion.negocioId }, include: { items: true },
      });
      if (!factura) throw new Error("FACTURA_INVALIDA");
      const proveedor = await tx.proveedor.findFirst({
        where: { id: proveedorId, negocioId: sesion.negocioId, OR: [{ activo: true }, { id: factura.proveedorId }] },
      });
      if (!proveedor) throw new Error("PROVEEDOR_INVALIDO");
      // Una factura histórica debe poder corregirse aunque alguno de sus productos
      // haya sido dado de baja después de cargarla.
      const productos = await tx.producto.findMany({ where: { id: { in: ids }, negocioId: sesion.negocioId } });
      if (productos.length !== ids.length) throw new Error("PRODUCTO_INVALIDO");

      const total = normalizados.reduce((suma, item) => suma + item.cantidad * item.costoUnitario, 0);
      const pagado = Math.max(0, factura.total - factura.saldo);
      if (proveedorId !== factura.proveedorId && pagado > 0.001) throw new Error("PROVEEDOR_CON_PAGOS");
      if (total + 0.001 < pagado) throw new Error("TOTAL_MENOR_PAGADO");

      const cantidadesAnteriores = new Map(factura.items.map((item) => [item.productoId, item.cantidad]));
      const cantidadesNuevas = new Map(normalizados.map((item) => [item.productoId, item.cantidad]));
      const productosAfectados = [...new Set([...cantidadesAnteriores.keys(), ...cantidadesNuevas.keys()])];
      const ajustes = productosAfectados.map((productoId) => ({
        productoId,
        cantidad: (cantidadesNuevas.get(productoId) || 0) - (cantidadesAnteriores.get(productoId) || 0),
        costoUnitario: normalizados.find((item) => item.productoId === productoId)?.costoUnitario || 0,
      })).filter((item) => Math.abs(item.cantidad) > 0.000001);

      const configuracion = await tx.configuracion.findUnique({ where: { negocioId: sesion.negocioId } });
      const margenBase = Math.max(0, configuracion?.margenVentaBasePct ?? 30);
      const detalles = normalizados.map((item) => {
        const producto = productos.find((p) => p.id === item.productoId)!;
        const multiplicador = producto.precioCosto > 0 && producto.precioVenta > 0 ? producto.precioVenta / producto.precioCosto : 1 + margenBase / 100;
        const sugerido = redondearPrecio(item.costoUnitario * multiplicador);
        return {
          productoId: producto.id, productoNombre: producto.nombre, cantidad: item.cantidad,
          costoAnterior: producto.precioCosto, costoBase: item.costoBase, impuestos: item.impuestos ?? [],
          costoUnitario: item.costoUnitario,
          precioVentaAnterior: producto.precioVenta,
          precioVentaSugerido: sugerido > producto.precioVenta ? sugerido : null,
          requiereAumento: item.costoUnitario > producto.precioCosto && sugerido > producto.precioVenta,
        };
      });

      await tx.facturaProveedorItem.deleteMany({ where: { facturaId: factura.id } });
      const quierePagada = body?.estado === "PAGADA";
      const pagoAdicional = quierePagada ? Math.max(0, total - pagado) : 0;
      const saldo = quierePagada ? 0 : Math.max(0, total - pagado);
      const actualizada = await tx.facturaProveedor.update({
        where: { id: factura.id },
        data: {
          proveedorId, numero: String(body?.numero || "").trim() || null, fecha, total, saldo,
          estado: saldo === 0 ? "PAGADA" : "CUENTA_CORRIENTE", comprobante,
          notas: String(body?.notas || "").trim() || null, items: { create: detalles },
        }, include: { items: true },
      });
      if (pagoAdicional > 0.001) {
        await tx.pagoProveedor.create({
          data: { proveedorId, facturaId: factura.id, monto: pagoAdicional, notas: "Pago registrado al editar la factura", negocioId: sesion.negocioId },
        });
      }
      if (ajustes.length > 0) {
        await tx.stockEntry.create({
          data: { proveedorId, tipo: "AJUSTE", notas: `Corrección factura ${actualizada.numero || `#${actualizada.id}`}`, negocioId: sesion.negocioId, items: { create: ajustes } },
        });
        for (const ajuste of ajustes) await tx.producto.update({ where: { id: ajuste.productoId }, data: { stock: { increment: ajuste.cantidad } } });
      }

      for (const productoId of productosAfectados) {
        const historico = await tx.facturaProveedorItem.findMany({
          where: { productoId, factura: { negocioId: sesion.negocioId } },
          include: { factura: { select: { id: true, fecha: true, proveedorId: true } } },
        });
        const ultimo = historico.sort((a, b) => b.factura.fecha.getTime() - a.factura.fecha.getTime() || b.factura.id - a.factura.id)[0];
        if (ultimo) await tx.producto.update({ where: { id: productoId }, data: { precioCosto: ultimo.costoUnitario, proveedorId: ultimo.factura.proveedorId } });
      }
      return actualizada;
    });
    return NextResponse.json(resultado);
  } catch (error) {
    const codigo = error instanceof Error ? error.message : "";
    if (codigo === "FACTURA_INVALIDA") return NextResponse.json({ error: "La factura no existe" }, { status: 404 });
    if (codigo === "PROVEEDOR_INVALIDO") return NextResponse.json({ error: "El proveedor no es válido" }, { status: 400 });
    if (codigo === "PRODUCTO_INVALIDO") return NextResponse.json({ error: "Uno de los productos no es válido" }, { status: 400 });
    if (codigo === "PROVEEDOR_CON_PAGOS") return NextResponse.json({ error: "No se puede cambiar el proveedor porque la factura ya tiene pagos registrados" }, { status: 400 });
    if (codigo === "TOTAL_MENOR_PAGADO") return NextResponse.json({ error: "El nuevo total no puede ser menor que lo ya pagado" }, { status: 400 });
    return NextResponse.json({ error: "No se pudo modificar la factura" }, { status: 500 });
  }
}
