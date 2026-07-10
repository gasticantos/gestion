import { prisma } from "@/lib/prisma";
import { notFound } from "next/navigation";
import Link from "next/link";
import AutoPrint from "@/components/AutoPrint";

export default async function ReservaTicketPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const reserva = await prisma.reserva.findUnique({
    where: { id: Number(id) },
    include: { mesa: true },
  });

  if (!reserva) notFound();

  return (
    <div className="max-w-md mx-auto flex flex-col gap-4">
      <div className="print:hidden flex items-center gap-3">
        <AutoPrint />
        <Link href="/reservas" className="text-sm text-neutral-400 hover:text-neutral-200">
          Volver a reservas
        </Link>
      </div>

      <div className="ticket bg-white text-black border border-neutral-300 rounded p-4 font-mono text-xs mx-auto w-[80mm]">
        <div className="text-center mb-2">
          <div className="font-bold text-sm">RESERVA</div>
          <div>{new Date(reserva.fecha).toLocaleString("es-AR")}</div>
        </div>
        <div className="border-t border-dashed my-2" />
        <div className="flex justify-between">
          <span>Nombre</span>
          <span className="font-bold">{reserva.nombre}</span>
        </div>
        <div className="flex justify-between">
          <span>Personas</span>
          <span className="font-bold">{reserva.personas}</span>
        </div>
        {reserva.telefono && (
          <div className="flex justify-between">
            <span>Teléfono</span>
            <span>{reserva.telefono}</span>
          </div>
        )}
        {reserva.mesa && (
          <div className="flex justify-between">
            <span>Mesa</span>
            <span>{reserva.mesa.nombre}</span>
          </div>
        )}
        {reserva.notas && (
          <>
            <div className="border-t border-dashed my-2" />
            <div>{reserva.notas}</div>
          </>
        )}
      </div>
    </div>
  );
}
