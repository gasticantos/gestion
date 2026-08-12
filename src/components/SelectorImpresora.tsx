"use client";

import { useEffect, useState } from "react";
import Button from "@/components/ui/Button";
import { input, label } from "@/components/ui/styles";
import {
  guardarImpresoraSeleccionada,
  desbloquearImpresora,
  impresoraBloqueada,
  ImpresoraLocal,
  listarImpresorasLocales,
  obtenerImpresoraSeleccionada,
  obtenerUltimoErrorImpresion,
  imprimirLocal,
} from "@/lib/imprimir";

export default function SelectorImpresora() {
  const [impresoras, setImpresoras] = useState<ImpresoraLocal[]>([]);
  const [seleccionada, setSeleccionada] = useState("");
  const [guardada, setGuardada] = useState("");
  const [bloqueada, setBloqueada] = useState(false);
  const [estado, setEstado] = useState("");
  const [error, setError] = useState("");
  const [cargando, setCargando] = useState(true);

  async function cargar() {
    setCargando(true);
    setError("");
    try {
      const disponibles = await listarImpresorasLocales();
      setImpresoras(disponibles);
      const nombreGuardado = obtenerImpresoraSeleccionada();
      const estaBloqueada = impresoraBloqueada();
      setGuardada(nombreGuardado);
      setBloqueada(estaBloqueada);

      if (estaBloqueada) {
        // Fija en este dispositivo: no tocar nada aunque la lista de impresoras
        // haya cambiado. Elegir otra requiere desbloquear a propósito.
        setSeleccionada(nombreGuardado);
      } else {
        // Sin selección fija todavía (primera vez en este dispositivo, o se
        // desbloqueó a propósito): proponer la predeterminada de Windows.
        const inicial =
          disponibles.find((p) => p.nombre === nombreGuardado)?.nombre ||
          disponibles.find((p) => p.predeterminada)?.nombre ||
          "";
        setSeleccionada(inicial);
      }
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
        const nombreGuardado = obtenerImpresoraSeleccionada();
        const estaBloqueada = impresoraBloqueada();
        setGuardada(nombreGuardado);
        setBloqueada(estaBloqueada);

        if (estaBloqueada) {
          setSeleccionada(nombreGuardado);
        } else {
          const inicial =
            disponibles.find((p) => p.nombre === nombreGuardado)?.nombre ||
            disponibles.find((p) => p.predeterminada)?.nombre ||
            "";
          setSeleccionada(inicial);
        }
        setEstado(disponibles.length ? "Agente conectado" : "No se encontraron impresoras");
      })
      .catch(() => {
        if (!activo) return;
        setImpresoras([]);
        setEstado("");
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
    if (!nombre) return;
    // Elegir una impresora la guarda y la bloquea de inmediato en este dispositivo.
    guardarImpresoraSeleccionada(nombre);
    setGuardada(nombre);
    setBloqueada(true);
    setEstado("Impresora fijada en este dispositivo");
    setError("");
  }

  function pedirDesbloqueo() {
    const ok = confirm(
      `La impresora fijada en este dispositivo es "${guardada}". ¿Seguro que querés cambiarla?`
    );
    if (!ok) return;
    desbloquearImpresora();
    setBloqueada(false);
    setEstado("");
    cargar();
  }

  async function probar() {
    setError("");
    setEstado("Enviando prueba...");
    const ok = await imprimirLocal(
      `PRUEBA DE IMPRESION\n${guardada}\n${new Date().toLocaleString("es-AR")}\n\n`
    );
    setEstado(ok ? "Prueba enviada correctamente" : "");
    if (!ok) {
      setError(
        obtenerUltimoErrorImpresion() ||
          "No se pudo imprimir la prueba. Revisá la impresora y el agente local."
      );
    }
  }

  return (
    <div className="flex flex-col gap-3">
      <div>
        <label className={label}>Impresora de tickets de este dispositivo</label>

        {bloqueada ? (
          <div className="flex items-center gap-2 rounded-lg border border-neutral-300 dark:border-neutral-700 bg-neutral-100 dark:bg-neutral-900 px-3 py-2">
            <span className="text-sm text-neutral-800 dark:text-neutral-100">🔒 {guardada}</span>
            <button
              type="button"
              onClick={pedirDesbloqueo}
              className="ml-auto text-xs px-2 py-1 rounded border border-neutral-300 dark:border-neutral-700 text-neutral-500 dark:text-neutral-400 hover:bg-neutral-200 dark:hover:bg-neutral-800"
            >
              Cambiar impresora
            </button>
          </div>
        ) : (
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
        )}

        <p className="mt-1 text-xs text-neutral-500">
          {bloqueada
            ? "Fija en esta computadora: no cambia sola, ni al entrar desde otro dispositivo. Para elegir otra, tocá \"Cambiar impresora\"."
            : "Elegí una impresora: queda guardada y fija en esta computadora en cuanto la selecciones."}
        </p>
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <Button type="button" size="sm" onClick={cargar} disabled={cargando}>
          {cargando ? "Buscando..." : "Actualizar lista"}
        </Button>
        <Button type="button" size="sm" variant="primary" onClick={probar} disabled={!guardada}>
          Imprimir prueba
        </Button>
        {estado && <span className="text-sm text-emerald-500">{estado}</span>}
      </div>
      {error && <p className="text-sm text-red-400">{error}</p>}
    </div>
  );
}
