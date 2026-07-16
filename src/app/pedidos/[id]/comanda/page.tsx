import { prisma } from "@/lib/prisma";
import { notFound } from "next/navigation";
import Link from "next/link";
import AutoPrint from "@/components/AutoPrint";

export default async function ComandaPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const pedido = await prisma.pedido.findUnique({
    where: { id: Number(id) },
    include: {
      items: { include: { producto: true } },
      venta: { include: { mesa: true } },
    },
  });

  if (!pedido) notFound();

  return (
    <div className="max-w-md mx-auto flex flex-col gap-4">
      <div className="print:hidden flex items-center gap-3">
        <AutoPrint />
        <Link href={`/mesas/${pedido.venta.mesaId}`} className="text-sm text-neutral-500 dark:text-neutral-400 hover:text-neutral-700 dark:hover:text-neutral-200">
          Volver a la mesa
        </Link>
      </div>

      <div className="ticket bg-white text-black border border-neutral-300 rounded p-4 font-mono text-xs mx-auto w-[80mm]">
        <div className="text-center mb-2">
          <div className="font-bold text-sm">COMANDA</div>
          <div>{pedido.venta.mesa?.nombre || "Mostrador"}</div>
          <div>{new Date(pedido.createdAt).toLocaleString("es-AR")}</div>
        </div>
        <div className="border-t border-dashed my-2" />
        {pedido.items.map((item) => (
          <div key={item.id} className="flex justify-between text-sm">
            <span>
              {item.cantidad} x {item.producto.nombre}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
