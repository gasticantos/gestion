"use client";

import { memo } from "react";
import { input, label } from "@/components/ui/styles";
import { formatearMoneda } from "@/lib/formato";

export type Metodo = "EFECTIVO" | "TARJETA" | "TRANSFERENCIA" | "FIADO";
export type PagoLinea = { metodo: Metodo; monto: string };
export type ClienteOpcion = { id: number; nombre: string; saldo: number };

const METODOS: { value: Metodo; label: string }[] = [
  { value: "EFECTIVO", label: "Efectivo" },
  { value: "TARJETA", label: "Tarjeta" },
  { value: "TRANSFERENCIA", label: "Transferencia" },
  { value: "FIADO", label: "Cuenta corriente" },
];

export function sumaPagos(pagos: PagoLinea[]) {
  return pagos.reduce((acc, p) => acc + (Number(p.monto) || 0), 0);
}

// Con un solo medio de pago, su monto siempre es el total: no hace falta mantenerlo
// sincronizado en el estado, se resuelve acá al validar/enviar.
export function resolvePagos(pagos: PagoLinea[], total: number): PagoLinea[] {
  if (pagos.length === 1) {
    return [{ ...pagos[0], monto: total.toFixed(2) }];
  }
  return pagos;
}

export function pagosCuadran(pagos: PagoLinea[], total: number) {
  return Math.abs(sumaPagos(resolvePagos(pagos, total)) - total) < 0.01;
}

export function requiereCliente(pagos: PagoLinea[]) {
  return pagos.some((p) => p.metodo === "FIADO");
}

function PagoSelectorBase({
  total,
  pagos,
  setPagos,
  clientes,
  clienteId,
  setClienteId,
}: {
  total: number;
  pagos: PagoLinea[];
  setPagos: (pagos: PagoLinea[]) => void;
  clientes: ClienteOpcion[];
  clienteId: string;
  setClienteId: (id: string) => void;
}) {
  function dividirPago() {
    setPagos([
      { metodo: "EFECTIVO", monto: (total / 2).toFixed(2) },
      { metodo: "TARJETA", monto: (total / 2).toFixed(2) },
    ]);
  }

  function unificarPago() {
    setPagos([{ metodo: "EFECTIVO", monto: total.toFixed(2) }]);
  }

  function actualizarPago(index: number, campo: "metodo" | "monto", valor: string) {
    setPagos(pagos.map((p, i) => (i === index ? { ...p, [campo]: valor } : p)));
  }

  const suma = sumaPagos(pagos);
  const cuadran = pagosCuadran(pagos, total);
  const necesitaCliente = requiereCliente(pagos);

  return (
    <div className="flex flex-col gap-3">
      {pagos.map((p, idx) => (
        <div key={idx} className="flex flex-col gap-1.5">
          {pagos.length > 1 && (
            <span className="text-xs text-neutral-500">Pago {idx + 1}</span>
          )}
          <div className="flex flex-col gap-2">
            {/* @container: el grid pasa a 1 fila de 4 solo cuando ESTE contenedor (no la ventana)
                tiene ancho real para eso; si no, se queda en 2x2, prolijo y sin cortar texto. */}
            <div className="@container">
              <div className="grid grid-cols-2 @min-[520px]:grid-cols-4 gap-2">
                {METODOS.map((m) => (
                  <button
                    key={m.value}
                    type="button"
                    onClick={() => actualizarPago(idx, "metodo", m.value)}
                    className={`px-2 py-1.5 rounded-full text-sm font-medium border transition-colors text-center whitespace-nowrap ${
                      p.metodo === m.value
                        ? "bg-blue-600 border-blue-600 text-neutral-950"
                        : "border-neutral-300 dark:border-neutral-700 text-neutral-700 dark:text-neutral-300 hover:border-neutral-500"
                    }`}
                  >
                    {m.label}
                  </button>
                ))}
              </div>
            </div>
            {pagos.length > 1 && (
              <input
                type="number"
                step="0.01"
                className={`${input} w-full sm:w-32 self-end`}
                value={p.monto}
                onChange={(e) => actualizarPago(idx, "monto", e.target.value)}
              />
            )}
          </div>
        </div>
      ))}
      {pagos.length === 1 ? (
        <button className="text-sm text-blue-500 hover:text-blue-400 self-start" onClick={dividirPago}>
          Dividir pago en dos medios
        </button>
      ) : (
        <button className="text-sm text-blue-500 hover:text-blue-400 self-start" onClick={unificarPago}>
          Usar un solo medio de pago
        </button>
      )}
      {!cuadran && (
        <span className="text-xs text-blue-600">
          Los pagos suman ${formatearMoneda(suma)}, falta ${formatearMoneda(total - suma)}
        </span>
      )}

      {necesitaCliente && (
        <div>
          <label className={label}>Cliente (cuenta corriente)</label>
          <select className={input} value={clienteId} onChange={(e) => setClienteId(e.target.value)}>
            <option value="">Elegir cliente...</option>
            {clientes.map((c) => (
              <option key={c.id} value={c.id}>
                {c.nombre} (saldo ${formatearMoneda(c.saldo)})
              </option>
            ))}
          </select>
        </div>
      )}
    </div>
  );
}

export default memo(PagoSelectorBase);
