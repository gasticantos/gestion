"use client";

import { useEffect, useState } from "react";
import Button from "@/components/ui/Button";
import { input, label } from "@/components/ui/styles";
import {
  guardarImpresoraSeleccionada,
  ImpresoraLocal,
  listarImpresorasLocales,
  obtenerImpresoraSeleccionada,
  imprimirLocal,
} from "@/lib/imprimir";

export default function SelectorImpresora() {
  const [impresoras, setImpresoras] = useState<ImpresoraLocal[]>([]);
  const [seleccionada, setSeleccionada] = useState("");
  const [estado, setEstado] = useState("");
  const [error, setError] = useState("");
  const [cargando, setCargando] = useState(true);

  async function cargar() {
    setCargando(true);
    setError("");
    try {
      const disponibles = await listarImpresorasLocales();
      setImpresoras(disponibles);
      const guardada = obtenerImpresoraSeleccionada();
      const inicial =
        disponibles.find((p) => p.nombre === guardada)?.nombre ||
        disponibles.find((p) => p.predeterminada)?.nombre ||
        "";
      setSeleccionada(inicial);
      if (inicial && !guardada) guardarImpresoraSeleccionada(inicial);
      setEstado(disponibles.length ? "Agente conectado" : "No se encontraron impresoras");
    } catch {
      setImpresoras([]);
      setEstado("");
      setError("No se pudo conectar con el agente local. Instalalo o reinicialo en esta computadora.");
    } finally {
      setCargando(false);
    }
  }

  useEffect(() => {
    let activo = true;
    listarImpresorasLocales()
      .then((disponibles) => {
        if (!activo) return;
        setImpresoras(disponibles);
        const guardada = obtenerImpresoraSeleccionada();
        const inicial =
          disponibles.find((p) => p.nombre === guardada)?.nombre ||
          disponibles.find((p) => p.predeterminada)?.nombre ||
          "";
        setSeleccionada(inicial);
        if (inicial && !guardada) guardarImpresoraSeleccionada(inicial);
        setEstado(disponibles.length ? "Agente conectado" : "No se encontraron impresoras");
      })
      .catch(() => {
        if (!activo) return;
        setError("No se pudo conectar con el agente local. Instalalo o reinicialo en esta computadora.");
      })
      .finally(() => {
        if (activo) setCargando(false);
      });
    return () => {
      activo = false;
    };
  }, []);

  function seleccionar(nombre: string) {
    setSeleccionada(nombre);
    guardarImpresoraSeleccionada(nombre);
    setEstado(nombre ? "Impresora guardada en este dispositivo" : "");
    setError("");
  }

  async function probar() {
    setError("");
    setEstado("Enviando prueba...");
    const ok = await imprimirLocal(
      `PRUEBA DE IMPRESION\n${seleccionada}\n${new Date().toLocaleString("es-AR")}\n\n`
    );
    setEstado(ok ? "Prueba enviada correctamente" : "");
    if (!ok) setError("No se pudo imprimir la prueba. Revisá la impresora y el agente local.");
  }

  return (
    <div className="flex flex-col gap-3">
      <div>
        <label className={label}>Impresora de tickets de este dispositivo</label>
        <select
          className={input}
          value={seleccionada}
          disabled={cargando || impresoras.length === 0}
          onChange={(e) => seleccionar(e.target.value)}
        >
          <option value="">{cargando ? "Buscando impresoras..." : "Seleccionar impresora"}</option>
          {impresoras.map((p) => (
            <option key={p.nombre} value={p.nombre}>
              {p.nombre}{p.predeterminada ? " (predeterminada)" : ""}{p.desconectada ? " — sin conexión" : ""}
            </option>
          ))}
        </select>
        <p className="mt-1 text-xs text-neutral-500">
          La elección queda guardada en esta computadora. Los tickets se imprimirán directamente, sin abrir confirmaciones.
        </p>
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <Button type="button" size="sm" onClick={cargar} disabled={cargando}>
          {cargando ? "Buscando..." : "Actualizar lista"}
        </Button>
        <Button type="button" size="sm" variant="primary" onClick={probar} disabled={!seleccionada}>
          Imprimir prueba
        </Button>
        {estado && <span className="text-sm text-emerald-500">{estado}</span>}
      </div>
      {error && <p className="text-sm text-red-400">{error}</p>}
      <div className="flex flex-wrap gap-3 text-sm">
        <a
          className="font-medium text-blue-500 hover:text-blue-400"
          href="/downloads/Gestion-Windows-Setup.exe"
        >
          Descargar aplicación para Windows
        </a>
        {error && (
          <a
            className="font-medium text-neutral-500 hover:text-neutral-700 dark:hover:text-neutral-300"
            href="https://github.com/gasticantos/gestion/raw/refs/heads/main/print-agent/INSTALAR-EPSON-TM-T20II-V2.zip"
          >
            Descargar solamente el agente antiguo
          </a>
        )}
      </div>
    </div>
  );
}
