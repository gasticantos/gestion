import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { sesionActual } from "@/lib/sesionServidor";

export async function POST(req: NextRequest) {
  const sesion = await sesionActual();
  if (!sesion) return NextResponse.json({ error: "No autenticado" }, { status: 401 });
  if (sesion.rol === "MOZO") return NextResponse.json({ error: "No tenés permiso" }, { status: 403 });
  const body = await req.json().catch(() => null);
  const proveedorId = Number(body?.proveedorId);
  const monto = Number(body?.monto);
  if (!Number.isInteger(proveedorId) || !Number.isFinite(monto) || monto <= 0) {
    return NextResponse.json({ error: "Indicá un proveedor y un monto válido" }, { status: 400 });
  }

  try {
    const pago = await prisma.$transaction(async (tx) => {
      const facturas = await tx.facturaProveedor.findMany({
        where: { proveedorId, negocioId: sesion.negocioId, saldo: { gt: 0 } },
        orderBy: [{ fecha: "asc" }, { id: "asc" }],
      });
      const deuda = facturas.reduce((total, factura) => total + factura.saldo, 0);
      if (deuda <= 0) throw new Error("SIN_DEUDA");
      if (monto > deuda + 0.001) throw new Error("MONTO_EXCEDIDO");

      let restante = monto;
      let primeraFacturaId: number | null = null;
      for (const factura of facturas) {
        if (restante <= 0) break;
        const aplicado = Math.min(restante, factura.saldo);
        if (!primeraFacturaId) primeraFacturaId = factura.id;
        const nuevoSaldo = Math.max(0, factura.saldo - aplicado);
        await tx.facturaProveedor.update({
          where: { id: factura.id },
          data: { saldo: nuevoSaldo, ...(nuevoSaldo === 0 ? { estado: "PAGADA" } : {}) },
        });
        restante -= aplicado;
      }
      return tx.pagoProveedor.create({
        data: {
          proveedorId,
          facturaId: facturas.length === 1 ? primeraFacturaId : null,
          monto,
          notas: String(body?.notas || "").trim() || null,
          negocioId: sesion.negocioId,
        },
      });
    });
    return NextResponse.json(pago, { status: 201 });
  } catch (error) {
    if (error instanceof Error && error.message === "SIN_DEUDA") return NextResponse.json({ error: "Ese proveedor no tiene deuda" }, { status: 400 });
    if (error instanceof Error && error.message === "MONTO_EXCEDIDO") return NextResponse.json({ error: "El pago supera la deuda del proveedor" }, { status: 400 });
    return NextResponse.json({ error: "No se pudo registrar el pago" }, { status: 500 });
  }
}
