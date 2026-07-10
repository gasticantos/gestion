import { prisma } from "@/lib/prisma";
import { notFound } from "next/navigation";
import Link from "next/link";
import AutoPrint from "@/components/AutoPrint";
import { formatearMoneda } from "@/lib/formato";

const METODOS: Record<string, string> = {
  EFECTIVO: "Efectivo",
  TARJETA: "Tarjeta",
  TRANSFERENCIA: "Transferencia",
  FIADO: "Cuenta corriente",
};

export default async function TicketPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const venta = await prisma.venta.findUnique({
    where: { id: Number(id) },
    include: {
      mesa: true,
      cliente: true,
      pagos: true,
      pedidos: { include: { items: { include: { producto: true } } }, orderBy: { createdAt: "asc" } },
    },
  });

  if (!venta) notFound();

  const items = venta.pedidos.flatMap((p) => p.items);

  return (
    <div className="max-w-md mx-auto flex flex-col gap-4">
      <div className="print:hidden flex items-center gap-3">
        <AutoPrint />
        <Link href="/venta" className="text-sm text-neutral-400 hover:text-neutral-200">
          Volver a la venta
        </Link>
      </div>

      <div className="ticket bg-white text-black border border-neutral-300 rounded p-4 font-mono text-xs mx-auto w-[80mm]">
        <div className="text-center mb-2">
          <div className="font-bold text-sm">COMPROBANTE DE VENTA</div>
          <div>{new Date(venta.createdAt).toLocaleString("es-AR")}</div>
          <div>Venta #{venta.id} {venta.mesa ? `· ${venta.mesa.nombre}` : "· Mostrador"}</div>
        </div>
        <div className="border-t border-dashed my-2" />
        {items.map((item) => (
          <div key={item.id} className="flex justify-between">
            <span>
              {item.cantidad} x {item.producto.nombre}
            </span>
            <span>${formatearMoneda(item.subtotal)}</span>
          </div>
        ))}
        <div className="border-t border-dashed my-2" />
        <div className="flex justify-between font-bold">
          <span>TOTAL</span>
          <span>${formatearMoneda(venta.total)}</span>
        </div>
        <div className="border-t border-dashed my-2" />
        {venta.pagos.map((pago) => (
          <div key={pago.id} className="flex justify-between">
            <span>{METODOS[pago.metodo]}</span>
            <span>${formatearMoneda(pago.monto)}</span>
          </div>
        ))}
        {venta.cliente && <div className="mt-1">Cliente: {venta.cliente.nombre}</div>}
        <div className="text-center mt-3">¡Gracias por su compra!</div>
      </div>
    </div>
  );
}
