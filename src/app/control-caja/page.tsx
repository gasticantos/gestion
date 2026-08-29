"use client";

import { useCallback, useEffect, useState } from "react";
import Card from "@/components/ui/Card";
import Button from "@/components/ui/Button";
import { input, th, td, trHover } from "@/components/ui/styles";
import { formatearMoneda } from "@/lib/formato";

type Movimiento = {
  id: number;
  tipo: "INGRESO" | "EGRESO";
  monto: number;
  concepto: string;
  operador: string;
  createdAt: string;
};

type EstadoCaja = {
  fechaJornada: string;
  iniciado: boolean;
  saldoInicial: number;
  saldoSugerido: number;
  ventasEfectivo: number;
  ingresos: number;
  egresos: number;
  efectivoEsperado: number;
  diferencia: number | null;
  control: null | {
    efectivoContado: number | null;
    saldoSiguiente: number | null;
    cerradoAt: string | null;
    movimientos: Movimiento[];
  };
};

export default function ControlCajaPage() {
  const [estado, setEstado] = useState<EstadoCaja | null>(null);
  const [saldoInicial, setSaldoInicial] = useState("");
  const [tipo, setTipo] = useState<"INGRESO" | "EGRESO">("INGRESO");
  const [monto, setMonto] = useState("");
  const [concepto, setConcepto] = useState("");
  const [efectivoContado, setEfectivoContado] = useState("");
  const [saldoSiguiente, setSaldoSiguiente] = useState("");
  const [procesando, setProcesando] = useState(false);
  const [mensaje, setMensaje] = useState("");
  const [error, setError] = useState("");

  function aplicarEstado(data: EstadoCaja) {
    setEstado(data);
    setSaldoInicial(String(data.saldoInicial));
    setEfectivoContado(data.control?.efectivoContado == null ? "" : String(data.control.efectivoContado));
    setSaldoSiguiente(
      String(data.control?.saldoSiguiente ?? data.efectivoEsperado)
    );
  }

  const cargar = useCallback(async () => {
    const res = await fetch("/api/control-caja", { cache: "no-store" });
    const data = await res.json().catch(() => null);
    if (!res.ok) {
      setError(data?.error || "No se pudo cargar el control de caja");
      return;
    }
    aplicarEstado(data);
  }, []);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- carga inicial del estado remoto
    cargar();
  }, [cargar]);

  async function guardar(body: object, exito: string) {
    setProcesando(true);
    setError("");
    setMensaje("");
    try {
      const res = await fetch("/api/control-caja", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = await res.json().catch(() => null);
      if (!res.ok) {
        setError(data?.error || "No se pudo guardar");
        return false;
      }
      aplicarEstado(data);
      setMensaje(exito);
      return true;
    } catch {
      setError("No se pudo conectar para guardar el control");
      return false;
    } finally {
      setProcesando(false);
    }
  }

  if (!estado) return <div className="text-sm text-neutral-500">Cargando control de caja...</div>;
  const cerrado = Boolean(estado.control?.cerradoAt);

  return (
    <div className="mx-auto flex max-w-5xl flex-col gap-5">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight text-neutral-900 dark:text-neutral-50">Control de caja</h1>
        <p className="mt-1 text-sm text-neutral-500">Jornada {estado.fechaJornada} · efectivo físico esperado y movimientos manuales.</p>
      </div>

      {!estado.iniciado ? (
        <Card className="flex max-w-xl flex-col gap-3 p-5">
          <div>
            <h2 className="font-semibold text-neutral-900 dark:text-neutral-50">Iniciar jornada</h2>
            <p className="text-sm text-neutral-500">Indicá cuánto efectivo hay en caja antes de comenzar.</p>
          </div>
          <label className="text-sm text-neutral-600 dark:text-neutral-300">
            Efectivo inicial
            <input className={`${input} mt-1`} type="number" min="0" step="0.01" value={saldoInicial} onChange={(e) => setSaldoInicial(e.target.value)} />
          </label>
          <Button disabled={procesando} onClick={() => guardar({ accion: "iniciar", saldoInicial }, "Caja iniciada correctamente")}>Iniciar caja</Button>
        </Card>
      ) : (
        <>
          <div className="grid grid-cols-2 gap-3 md:grid-cols-5">
            {[
              ["Efectivo inicial", estado.saldoInicial],
              ["Ventas en efectivo", estado.ventasEfectivo],
              ["Otros ingresos", estado.ingresos],
              ["Egresos", -estado.egresos],
              ["Efectivo esperado", estado.efectivoEsperado],
            ].map(([titulo, valor]) => (
              <Card key={String(titulo)} className="p-4">
                <div className="text-xs text-neutral-500">{titulo}</div>
                <div className={`mt-1 text-xl font-semibold ${Number(valor) < 0 ? "text-red-500" : "text-neutral-900 dark:text-neutral-50"}`}>
                  ${formatearMoneda(Number(valor))}
                </div>
              </Card>
            ))}
          </div>

          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <Card className="flex flex-col gap-3 p-5">
              <div>
                <h2 className="font-semibold text-neutral-900 dark:text-neutral-50">Ingreso o egreso</h2>
                <p className="text-xs text-neutral-500">Para movimientos que no provienen de una venta.</p>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <button type="button" onClick={() => setTipo("INGRESO")} className={`rounded-lg border px-3 py-2 text-sm ${tipo === "INGRESO" ? "border-emerald-600 bg-emerald-600/10 text-emerald-700" : "border-neutral-300 dark:border-neutral-700"}`}>Ingreso</button>
                <button type="button" onClick={() => setTipo("EGRESO")} className={`rounded-lg border px-3 py-2 text-sm ${tipo === "EGRESO" ? "border-red-500 bg-red-500/10 text-red-600" : "border-neutral-300 dark:border-neutral-700"}`}>Egreso</button>
              </div>
              <input className={input} type="number" min="0.01" step="0.01" placeholder="Monto" value={monto} onChange={(e) => setMonto(e.target.value)} />
              <input className={input} maxLength={160} placeholder="Concepto (ej.: cambio, compra de hielo)" value={concepto} onChange={(e) => setConcepto(e.target.value)} />
              <Button
                disabled={procesando || cerrado}
                onClick={async () => {
                  if (await guardar({ accion: "movimiento", tipo, monto, concepto }, "Movimiento registrado")) {
                    setMonto("");
                    setConcepto("");
                  }
                }}
              >Registrar movimiento</Button>
            </Card>

            <Card className="flex flex-col gap-3 p-5">
              <div>
                <h2 className="font-semibold text-neutral-900 dark:text-neutral-50">Arqueo y próxima jornada</h2>
                <p className="text-xs text-neutral-500">Contá el efectivo real y prepará con cuánto comenzará el turno siguiente.</p>
              </div>
              <label className="text-sm text-neutral-600 dark:text-neutral-300">Efectivo contado<input className={`${input} mt-1`} type="number" min="0" step="0.01" value={efectivoContado} onChange={(e) => setEfectivoContado(e.target.value)} /></label>
              {estado.diferencia != null && (
                <div className={`rounded-lg px-3 py-2 text-sm ${estado.diferencia === 0 ? "bg-emerald-600/10 text-emerald-700" : "bg-amber-500/10 text-amber-700"}`}>
                  Diferencia: ${formatearMoneda(estado.diferencia)}
                </div>
              )}
              <label className="text-sm text-neutral-600 dark:text-neutral-300">Efectivo inicial del próximo turno<input className={`${input} mt-1`} type="number" min="0" step="0.01" value={saldoSiguiente} onChange={(e) => setSaldoSiguiente(e.target.value)} /></label>
              <Button variant="secondary" disabled={procesando || cerrado} onClick={() => guardar({ accion: "arqueo", efectivoContado, saldoSiguiente }, "Arqueo guardado para el cierre")}>Guardar arqueo</Button>
            </Card>
          </div>

          <Card>
            <div className="border-b border-neutral-200 p-3 text-sm font-medium text-neutral-700 dark:border-neutral-800 dark:text-neutral-200">Movimientos manuales</div>
            {!estado.control?.movimientos.length ? (
              <div className="p-4 text-sm text-neutral-500">No hay ingresos ni egresos manuales.</div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead><tr><th className={th}>Hora</th><th className={th}>Tipo</th><th className={th}>Concepto</th><th className={th}>Responsable</th><th className={th}>Monto</th></tr></thead>
                  <tbody>{estado.control.movimientos.map((movimiento) => (
                    <tr key={movimiento.id} className={trHover}>
                      <td className={td}>{new Date(movimiento.createdAt).toLocaleTimeString("es-AR")}</td>
                      <td className={td}>{movimiento.tipo === "INGRESO" ? "Ingreso" : "Egreso"}</td>
                      <td className={td}>{movimiento.concepto}</td>
                      <td className={td}>{movimiento.operador}</td>
                      <td className={`${td} font-semibold ${movimiento.tipo === "INGRESO" ? "text-emerald-600" : "text-red-500"}`}>{movimiento.tipo === "INGRESO" ? "+" : "−"}${formatearMoneda(movimiento.monto)}</td>
                    </tr>
                  ))}</tbody>
                </table>
              </div>
            )}
          </Card>
        </>
      )}

      {mensaje && <div className="rounded-lg border border-emerald-300 bg-emerald-50 px-3 py-2 text-sm text-emerald-700">{mensaje}</div>}
      {error && <div className="rounded-lg border border-red-300 bg-red-50 px-3 py-2 text-sm text-red-700">{error}</div>}
    </div>
  );
}
