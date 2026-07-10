import Link from "next/link";
import AutoPrint from "@/components/AutoPrint";
import { obtenerReporteVentas } from "@/lib/reportes";
import { formatearMoneda } from "@/lib/formato";

const METODO_LABEL: Record<string, string> = {
  EFECTIVO: "Efectivo",
  TARJETA: "Tarjeta",
  TRANSFERENCIA: "Transferencia",
  FIADO: "Cuenta corriente",
};

export default async function ReporteTicketPage({
  searchParams,
}: {
  searchParams: Promise<{ desde?: string; hasta?: string }>;
}) {
  const { desde: desdeStr, hasta: hastaStr } = await searchParams;
  const hoy = new Date().toISOString().slice(0, 10);
  const desde = new Date(`${desdeStr || hoy}T00:00:00`);
  const hasta = new Date(`${hastaStr || hoy}T23:59:59.999`);

  const reporte = await obtenerReporteVentas(desde, hasta);
  const metodos = Object.keys(METODO_LABEL);

  return (
    <div className="max-w-md mx-auto flex flex-col gap-4">
      <div className="print:hidden flex items-center gap-3">
        <AutoPrint />
        <Link href="/reportes" className="text-sm text-neutral-400 hover:text-neutral-200">
          Volver a reportes
        </Link>
      </div>

      <div className="ticket bg-white text-black border border-neutral-300 rounded p-4 font-mono text-xs mx-auto w-[80mm]">
        <div className="text-center mb-2">
          <div className="font-bold text-sm">RESUMEN DE VENTAS</div>
          <div>
            {reporte.desde === reporte.hasta ? reporte.desde : `${reporte.desde} al ${reporte.hasta}`}
          </div>
        </div>
        <div className="border-t border-dashed my-2" />

        <div className="flex justify-between font-bold">
          <span>TOTAL COMBINADO</span>
          <span>${formatearMoneda(reporte.combinado.total)}</span>
        </div>
        <div className="flex justify-between">
          <span>Cantidad de ventas</span>
          <span>{reporte.cantidadVentas}</span>
        </div>

        <div className="border-t border-dashed my-2" />
        <div className="font-bold mb-1">MOSTRADOR (${formatearMoneda(reporte.porCanal.MOSTRADOR.total)})</div>
        {metodos.map((m) => (
          <div key={m} className="flex justify-between">
            <span>{METODO_LABEL[m]}</span>
            <span>${formatearMoneda(reporte.porCanal.MOSTRADOR.pagos[m as keyof typeof reporte.porCanal.MOSTRADOR.pagos])}</span>
          </div>
        ))}

        <div className="border-t border-dashed my-2" />
        <div className="font-bold mb-1">MESAS (${formatearMoneda(reporte.porCanal.MESA.total)})</div>
        {metodos.map((m) => (
          <div key={m} className="flex justify-between">
            <span>{METODO_LABEL[m]}</span>
            <span>${formatearMoneda(reporte.porCanal.MESA.pagos[m as keyof typeof reporte.porCanal.MESA.pagos])}</span>
          </div>
        ))}

        <div className="border-t border-dashed my-2" />
        <div className="font-bold mb-1">TOTAL POR MEDIO DE PAGO</div>
        {metodos.map((m) => (
          <div key={m} className="flex justify-between">
            <span>{METODO_LABEL[m]}</span>
            <span>${formatearMoneda(reporte.combinado.pagos[m as keyof typeof reporte.combinado.pagos])}</span>
          </div>
        ))}

        {reporte.categorias.length > 0 && (
          <>
            <div className="border-t border-dashed my-2" />
            <div className="font-bold mb-1">MÁS VENDIDO POR CATEGORÍA</div>
            {reporte.categorias.map((c) => (
              <div key={c.categoria} className="flex justify-between">
                <span>
                  {c.categoria} ({c.cantidad})
                </span>
                <span>${formatearMoneda(c.importe)}</span>
              </div>
            ))}
          </>
        )}
      </div>
    </div>
  );
}
