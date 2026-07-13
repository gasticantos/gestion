"use client";

import { useEffect, useMemo, useState } from "react";
import Card from "@/components/ui/Card";
import Button from "@/components/ui/Button";
import { input, th, td, trHover } from "@/components/ui/styles";
import TrendArea from "@/components/charts/TrendArea";
import CategoricalBarChart, { BarDatum } from "@/components/charts/CategoricalBarChart";
import { formatearMoneda } from "@/lib/formato";

type Metodo = "EFECTIVO" | "TARJETA" | "TRANSFERENCIA" | "FIADO";

type ReporteVentas = {
  desde: string;
  hasta: string;
  cantidadVentas: number;
  porCanal: Record<"MOSTRADOR" | "MESA", { total: number; pagos: Record<Metodo, number> }>;
  combinado: { total: number; pagos: Record<Metodo, number> };
  categorias: { categoria: string; cantidad: number; importe: number }[];
  productos: { nombre: string; cantidad: number; importe: number }[];
  serieDiaria: { fecha: string; total: number }[];
};

const METODO_LABEL: Record<Metodo, string> = {
  EFECTIVO: "Efectivo",
  TARJETA: "Tarjeta",
  TRANSFERENCIA: "Transferencia",
  FIADO: "Cuenta corriente",
};

// Paleta categórica validada (CVD-safe) para 4 series, evitando los hues de estado (verde/rojo).
const METODO_COLOR: Record<Metodo, string> = {
  EFECTIVO: "#3987e5",
  TARJETA: "#c98500",
  TRANSFERENCIA: "#d55181",
  FIADO: "#9085e9",
};

// Mismos 4 hues validados; se asignan por orden ya que las categorías son gestionables por el usuario.
const PALETA_CATEGORIAS = ["#3987e5", "#c98500", "#d55181", "#9085e9"];

function toYMD(d: Date) {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

function sumarDias(d: Date, n: number) {
  const r = new Date(d);
  r.setDate(r.getDate() + n);
  return r;
}

type Preset = "hoy" | "ayer" | "semana" | "mes" | "mesAnterior" | "custom";

function rangoPreset(preset: Preset): { desde: string; hasta: string } {
  const hoy = new Date();
  switch (preset) {
    case "hoy":
      return { desde: toYMD(hoy), hasta: toYMD(hoy) };
    case "ayer": {
      const ayer = sumarDias(hoy, -1);
      return { desde: toYMD(ayer), hasta: toYMD(ayer) };
    }
    case "semana":
      return { desde: toYMD(sumarDias(hoy, -6)), hasta: toYMD(hoy) };
    case "mes": {
      const inicio = new Date(hoy.getFullYear(), hoy.getMonth(), 1);
      return { desde: toYMD(inicio), hasta: toYMD(hoy) };
    }
    case "mesAnterior": {
      const inicio = new Date(hoy.getFullYear(), hoy.getMonth() - 1, 1);
      const fin = new Date(hoy.getFullYear(), hoy.getMonth(), 0);
      return { desde: toYMD(inicio), hasta: toYMD(fin) };
    }
    default:
      return { desde: toYMD(hoy), hasta: toYMD(hoy) };
  }
}

const PRESETS: { value: Preset; label: string }[] = [
  { value: "hoy", label: "Hoy" },
  { value: "ayer", label: "Ayer" },
  { value: "semana", label: "Últimos 7 días" },
  { value: "mes", label: "Este mes" },
  { value: "mesAnterior", label: "Mes anterior" },
  { value: "custom", label: "Personalizado" },
];

export default function ReportesPage() {
  const [preset, setPreset] = useState<Preset>("hoy");
  const [rango, setRango] = useState(() => rangoPreset("hoy"));
  const [reporte, setReporte] = useState<ReporteVentas | null>(null);
  const [loading, setLoading] = useState(true);

  async function cargar(desde: string, hasta: string) {
    setLoading(true);
    const res = await fetch(`/api/reportes?desde=${desde}&hasta=${hasta}`);
    setReporte(await res.json());
    setLoading(false);
  }

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- recarga al cambiar el período
    cargar(rango.desde, rango.hasta);
  }, [rango]);

  function elegirPreset(p: Preset) {
    setPreset(p);
    if (p !== "custom") {
      setRango(rangoPreset(p));
    }
  }

  const pagosChart: BarDatum[] = useMemo(() => {
    if (!reporte) return [];
    return (Object.keys(METODO_LABEL) as Metodo[])
      .map((m) => ({ name: METODO_LABEL[m], value: reporte.combinado.pagos[m], color: METODO_COLOR[m] }))
      .filter((d) => d.value > 0);
  }, [reporte]);

  const categoriasChart: BarDatum[] = useMemo(() => {
    if (!reporte) return [];
    return reporte.categorias.map((c, idx) => ({
      name: c.categoria,
      value: c.importe,
      color: PALETA_CATEGORIAS[idx % PALETA_CATEGORIAS.length],
    }));
  }, [reporte]);

  return (
    <div className="max-w-5xl mx-auto flex flex-col gap-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <h1 className="text-2xl font-semibold tracking-tight text-neutral-900 dark:text-neutral-50">Reportes de ventas</h1>
        <a
          href={`/reportes/ticket?desde=${rango.desde}&hasta=${rango.hasta}`}
          target="_blank"
          rel="noopener noreferrer"
        >
          <Button variant="primary">Imprimir resumen</Button>
        </a>
      </div>

      <Card className="p-4 flex flex-col gap-3">
        <div className="flex flex-wrap gap-2">
          {PRESETS.map((p) => (
            <button
              key={p.value}
              onClick={() => elegirPreset(p.value)}
              className={`px-3 py-1.5 rounded-lg text-sm font-medium border transition-colors ${
                preset === p.value
                  ? "bg-blue-600 border-blue-600 text-neutral-950"
                  : "border-neutral-300 dark:border-neutral-700 text-neutral-700 dark:text-neutral-300 hover:border-neutral-500"
              }`}
            >
              {p.label}
            </button>
          ))}
        </div>
        {preset === "custom" && (
          <div className="flex items-center gap-2">
            <input
              type="date"
              className={`${input} max-w-[160px]`}
              value={rango.desde}
              onChange={(e) => setRango((r) => ({ ...r, desde: e.target.value }))}
            />
            <span className="text-neutral-500 text-sm">hasta</span>
            <input
              type="date"
              className={`${input} max-w-[160px]`}
              value={rango.hasta}
              onChange={(e) => setRango((r) => ({ ...r, hasta: e.target.value }))}
            />
          </div>
        )}
      </Card>

      {loading || !reporte ? (
        <div className="text-sm text-neutral-500">Cargando...</div>
      ) : (
        <>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <Card className="p-4">
              <div className="text-xs text-neutral-500">Total combinado</div>
              <div className="text-2xl font-semibold text-neutral-900 dark:text-neutral-50 mt-1">
                ${formatearMoneda(reporte.combinado.total)}
              </div>
            </Card>
            <Card className="p-4">
              <div className="text-xs text-neutral-500">Mostrador</div>
              <div className="text-2xl font-semibold text-neutral-900 dark:text-neutral-50 mt-1">
                ${formatearMoneda(reporte.porCanal.MOSTRADOR.total)}
              </div>
            </Card>
            <Card className="p-4">
              <div className="text-xs text-neutral-500">Mesas</div>
              <div className="text-2xl font-semibold text-neutral-900 dark:text-neutral-50 mt-1">
                ${formatearMoneda(reporte.porCanal.MESA.total)}
              </div>
            </Card>
            <Card className="p-4">
              <div className="text-xs text-neutral-500">Cantidad de ventas</div>
              <div className="text-2xl font-semibold text-neutral-900 dark:text-neutral-50 mt-1">{reporte.cantidadVentas}</div>
            </Card>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            {(
              [
                ["Mostrador", reporte.porCanal.MOSTRADOR],
                ["Mesas", reporte.porCanal.MESA],
                ["Combinado", reporte.combinado],
              ] as const
            ).map(([titulo, datos]) => (
              <Card key={titulo} className="p-4">
                <div className="text-sm font-medium text-neutral-700 dark:text-neutral-200 mb-2">{titulo}</div>
                <div className="flex flex-col gap-1.5">
                  {(Object.keys(METODO_LABEL) as Metodo[]).map((m) => (
                    <div key={m} className="flex justify-between text-sm">
                      <span className="text-neutral-500 dark:text-neutral-400">{METODO_LABEL[m]}</span>
                      <span className="text-neutral-800 dark:text-neutral-100">${formatearMoneda(datos.pagos[m])}</span>
                    </div>
                  ))}
                  <div className="flex justify-between text-sm font-semibold border-t border-neutral-200 dark:border-neutral-800 pt-1.5 mt-1">
                    <span className="text-neutral-700 dark:text-neutral-300">Total</span>
                    <span className="text-neutral-900 dark:text-neutral-50">${formatearMoneda(datos.total)}</span>
                  </div>
                </div>
              </Card>
            ))}
          </div>

          {reporte.serieDiaria.length > 1 && (
            <Card className="p-4">
              <div className="text-sm font-medium text-neutral-700 dark:text-neutral-200 mb-2">Evolución de ventas</div>
              <TrendArea data={reporte.serieDiaria} />
            </Card>
          )}

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <Card className="p-4">
              <div className="text-sm font-medium text-neutral-700 dark:text-neutral-200 mb-2">Métodos de pago</div>
              {pagosChart.length === 0 ? (
                <div className="text-sm text-neutral-500">Sin datos en el período</div>
              ) : (
                <CategoricalBarChart data={pagosChart} />
              )}
            </Card>
            <Card className="p-4">
              <div className="text-sm font-medium text-neutral-700 dark:text-neutral-200 mb-2">Más vendido por categoría</div>
              {categoriasChart.length === 0 ? (
                <div className="text-sm text-neutral-500">Sin datos en el período</div>
              ) : (
                <CategoricalBarChart data={categoriasChart} />
              )}
            </Card>
          </div>

          <Card>
            <div className="p-3 border-b border-neutral-200 dark:border-neutral-800 text-sm text-neutral-500 dark:text-neutral-400">Top productos</div>
            {reporte.productos.length === 0 ? (
              <div className="p-4 text-sm text-neutral-500">Sin datos en el período</div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr>
                      <th className={th}>Producto</th>
                      <th className={th}>Cantidad</th>
                      <th className={th}>Importe</th>
                    </tr>
                  </thead>
                  <tbody>
                    {reporte.productos.map((p) => (
                      <tr key={p.nombre} className={trHover}>
                        <td className={td}>{p.nombre}</td>
                        <td className={td}>{p.cantidad}</td>
                        <td className={td}>${formatearMoneda(p.importe)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </Card>
        </>
      )}
    </div>
  );
}
