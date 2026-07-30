"use client";

import { useEffect, useState } from "react";
import { invoke, isTauri } from "@tauri-apps/api/core";
import Button from "@/components/ui/Button";

type InfoActualizacion = {
  version: string;
};

function compararVersiones(a: string, b: string) {
  const izquierda = a.split(".").map(Number);
  const derecha = b.split(".").map(Number);
  const largo = Math.max(izquierda.length, derecha.length);
  for (let i = 0; i < largo; i += 1) {
    const diferencia = (izquierda[i] || 0) - (derecha[i] || 0);
    if (diferencia !== 0) return diferencia;
  }
  return 0;
}

export default function ActualizadorWindows() {
  const [esEscritorio, setEsEscritorio] = useState(false);
  const [versionActual, setVersionActual] = useState("");
  const [versionNueva, setVersionNueva] = useState("");
  const [estado, setEstado] = useState("");
  const [error, setError] = useState("");
  const [cargando, setCargando] = useState(false);

  useEffect(() => {
    if (!isTauri()) return;
    queueMicrotask(() => setEsEscritorio(true));
    invoke<string>("version_actual")
      .then(setVersionActual)
      .catch(() => setError("Esta versión todavía no incluye el actualizador automático."));
  }, []);

  async function buscarActualizacion() {
    setCargando(true);
    setError("");
    setEstado("Buscando actualización...");
    try {
      const respuesta = await fetch(`/actualizacion.json?ahora=${Date.now()}`, { cache: "no-store" });
      if (!respuesta.ok) throw new Error();
      const info = (await respuesta.json()) as InfoActualizacion;
      setVersionNueva(info.version);
      setEstado(
        compararVersiones(info.version, versionActual) > 0
          ? `Nueva versión ${info.version} disponible`
          : "Gestión ya está actualizado"
      );
    } catch {
      setEstado("");
      setError("No se pudo consultar la actualización. Revisá la conexión a internet.");
    } finally {
      setCargando(false);
    }
  }

  async function actualizar() {
    setCargando(true);
    setError("");
    setEstado("Descargando la actualización. Gestión se cerrará automáticamente...");
    try {
      await invoke("instalar_actualizacion");
    } catch {
      setCargando(false);
      setEstado("");
      setError("No se pudo iniciar la actualización automática.");
    }
  }

  if (!esEscritorio) return null;

  const hayActualizacion =
    Boolean(versionNueva && versionActual) && compararVersiones(versionNueva, versionActual) > 0;

  return (
    <div className="flex flex-col gap-3">
      <div>
        <div className="text-sm font-medium text-neutral-700 dark:text-neutral-200">
          Actualizaciones de Gestión
        </div>
        <p className="mt-1 text-xs text-neutral-500">
          Versión instalada: {versionActual || "consultando..."}
        </p>
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <Button type="button" size="sm" onClick={buscarActualizacion} disabled={cargando || !versionActual}>
          {cargando && !hayActualizacion ? "Buscando..." : "Buscar actualización"}
        </Button>
        {hayActualizacion && (
          <Button type="button" size="sm" variant="primary" onClick={actualizar} disabled={cargando}>
            Actualizar ahora
          </Button>
        )}
        {!hayActualizacion && versionActual && (
          <Button type="button" size="sm" variant="secondary" onClick={actualizar} disabled={cargando}>
            Reparar instalación
          </Button>
        )}
      </div>
      {estado && <p className="text-sm text-emerald-500">{estado}</p>}
      {error && <p className="text-sm text-red-400">{error}</p>}
    </div>
  );
}
