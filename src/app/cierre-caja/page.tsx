"use client";

import { useState } from "react";
import Button from "@/components/ui/Button";
import Card from "@/components/ui/Card";
import { formatearMoneda } from "@/lib/formato";

export default function CierreCajaPage() {
  const [cerrando, setCerrando] = useState(false);
  const [resultado, setResultado] = useState("");
  const [error, setError] = useState("");

  async function cerrarCaja(recuperarAnterior = false) {
    const pregunta = recuperarAnterior
      ? "¿Recuperar el cierre anterior, enviarlo a impresión y mandar su PDF a Telegram?"
      : "¿Cerrar la jornada e imprimir el cierre completo en la ticketera principal?";
    if (!confirm(pregunta)) return;

    setCerrando(true);
    setResultado("");
    setError("");
    try {
      const res = await fetch("/api/reportes/cierre", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ recuperarAnterior }),
      });
      const data = await res.json().catch(() => null);
      if (!res.ok) {
        setError(data?.error || "No se pudo generar el cierre de caja");
        return;
      }
      const telegram = data.telegramEnviado
        ? " · PDF enviado a Telegram"
        : ` · Telegram no enviado${data.telegramError ? ` (${data.telegramError})` : ""}`;
      setResultado(`Cierre enviado a impresión: ${data.cantidadVentas} ventas · $${formatearMoneda(data.total)}${telegram}`);
      localStorage.removeItem("carrito-venta");
    } catch {
      setError("No se pudo conectar para generar el cierre de caja");
    } finally {
      setCerrando(false);
    }
  }

  return (
    <div className="mx-auto flex max-w-lg flex-col gap-5">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight text-neutral-900 dark:text-neutral-50">
          Cierre de caja
        </h1>
        <p className="mt-1 text-sm text-neutral-500">
          Cierra la jornada comercial actual y envía el resumen a la impresora principal.
        </p>
      </div>

      <Card className="flex flex-col gap-4 p-5">
        <div className="rounded-lg border border-amber-300 bg-amber-50 px-3 py-3 text-sm text-amber-900 dark:border-amber-900 dark:bg-amber-950 dark:text-amber-100">
          Antes de cerrar, verificá que no queden mesas abiertas. Si luego se realizan ventas nuevas, podés generar otro cierre dentro de la misma jornada.
        </div>
        <Button
          type="button"
          variant="primary"
          onClick={() => cerrarCaja(false)}
          disabled={cerrando}
          className="w-full py-3"
        >
          {cerrando ? "Generando cierre..." : "Cerrar caja e imprimir"}
        </Button>
        <Button
          type="button"
          variant="secondary"
          onClick={() => cerrarCaja(true)}
          disabled={cerrando}
          className="w-full py-3"
        >
          Recuperar cierre anterior
        </Button>
        {resultado && (
          <p className="rounded-lg border border-emerald-300 bg-emerald-50 px-3 py-2 text-sm text-emerald-700 dark:border-emerald-900 dark:bg-emerald-950 dark:text-emerald-200">
            {resultado}
          </p>
        )}
        {error && (
          <p className="rounded-lg border border-red-300 bg-red-50 px-3 py-2 text-sm text-red-700 dark:border-red-900 dark:bg-red-950 dark:text-red-200">
            {error}
          </p>
        )}
      </Card>
    </div>
  );
}
