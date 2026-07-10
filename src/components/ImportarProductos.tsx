"use client";

import { useRef, useState } from "react";
import Button from "@/components/ui/Button";
import Plegable from "@/components/ui/Plegable";

type Resumen = {
  totalFilas: number;
  nuevos: number;
  actualizados: number;
  omitidos: number;
  categoriasNuevas: string[];
  sinCodigoBarras: number;
  stockNegativo: number;
  porCategoria: { categoria: string; cantidad: number }[];
  muestra: { nombre: string; stock: number; precioCosto: number; categoria: string }[];
  errores: string[];
};

export default function ImportarProductos({ onImportado }: { onImportado: () => void }) {
  const [archivo, setArchivo] = useState<File | null>(null);
  const [resumen, setResumen] = useState<Resumen | null>(null);
  const [error, setError] = useState("");
  const [cargando, setCargando] = useState(false);
  const [confirmado, setConfirmado] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  async function previsualizar() {
    if (!archivo) return;
    setError("");
    setConfirmado(false);
    setCargando(true);
    const formData = new FormData();
    formData.append("archivo", archivo);
    formData.append("confirmar", "false");
    const res = await fetch("/api/productos/importar", { method: "POST", body: formData });
    setCargando(false);
    if (!res.ok) {
      const data = await res.json();
      setError(data.error || "Ocurrió un error");
      return;
    }
    setResumen(await res.json());
  }

  async function confirmarImportacion() {
    if (!archivo) return;
    setError("");
    setCargando(true);
    const formData = new FormData();
    formData.append("archivo", archivo);
    formData.append("confirmar", "true");
    const res = await fetch("/api/productos/importar", { method: "POST", body: formData });
    setCargando(false);
    if (!res.ok) {
      const data = await res.json();
      setError(data.error || "Ocurrió un error");
      return;
    }
    setResumen(await res.json());
    setConfirmado(true);
    onImportado();
  }

  function reiniciar() {
    setArchivo(null);
    setResumen(null);
    setConfirmado(false);
    setError("");
    if (inputRef.current) inputRef.current.value = "";
  }

  return (
    <Plegable titulo="Importar productos desde Excel">
      {!confirmado && (
        <div className="flex items-center gap-2">
          <input
            ref={inputRef}
            type="file"
            accept=".xlsx,.xls"
            onChange={(e) => {
              setArchivo(e.target.files?.[0] ?? null);
              setResumen(null);
            }}
            className="text-sm text-neutral-300 file:mr-3 file:py-1.5 file:px-3 file:rounded-lg file:border file:border-neutral-700 file:bg-neutral-800 file:text-neutral-200 file:text-sm"
          />
          <Button variant="secondary" disabled={!archivo || cargando} onClick={previsualizar}>
            {cargando ? "Leyendo..." : "Vista previa"}
          </Button>
        </div>
      )}

      {error && <span className="text-sm text-red-400">{error}</span>}

      {resumen && (
        <div className="flex flex-col gap-3 text-sm">
          {confirmado ? (
            <div className="text-emerald-400 font-medium">
              Importación completada: {resumen.nuevos} producto(s) nuevo(s), {resumen.actualizados}{" "}
              actualizado(s).
            </div>
          ) : (
            <div className="text-blue-500">
              Vista previa — todavía no se guardó nada. Revisá y confirmá abajo.
            </div>
          )}

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
            <div className="bg-neutral-800/50 rounded-lg p-2">
              <div className="text-xs text-neutral-500">Filas leídas</div>
              <div className="font-semibold text-neutral-100">{resumen.totalFilas}</div>
            </div>
            <div className="bg-neutral-800/50 rounded-lg p-2">
              <div className="text-xs text-neutral-500">Nuevos</div>
              <div className="font-semibold text-neutral-100">{resumen.nuevos}</div>
            </div>
            <div className="bg-neutral-800/50 rounded-lg p-2">
              <div className="text-xs text-neutral-500">Actualizados</div>
              <div className="font-semibold text-neutral-100">{resumen.actualizados}</div>
            </div>
            <div className="bg-neutral-800/50 rounded-lg p-2">
              <div className="text-xs text-neutral-500">Sin código de barras</div>
              <div className="font-semibold text-neutral-100">{resumen.sinCodigoBarras}</div>
            </div>
          </div>

          {resumen.categoriasNuevas.length > 0 && (
            <div>
              <div className="text-xs text-neutral-500 mb-1">
                Categorías nuevas que se van a crear ({resumen.categoriasNuevas.length})
              </div>
              <div className="flex flex-wrap gap-1.5">
                {resumen.categoriasNuevas.map((c) => (
                  <span key={c} className="px-2 py-0.5 rounded-full bg-neutral-800 text-neutral-300 text-xs">
                    {c}
                  </span>
                ))}
              </div>
            </div>
          )}

          <div>
            <div className="text-xs text-neutral-500 mb-1">Por categoría</div>
            <div className="flex flex-wrap gap-1.5">
              {resumen.porCategoria.map((c) => (
                <span key={c.categoria} className="px-2 py-0.5 rounded-full bg-neutral-800 text-neutral-300 text-xs">
                  {c.categoria}: {c.cantidad}
                </span>
              ))}
            </div>
          </div>

          {resumen.errores.length > 0 && (
            <div>
              <div className="text-xs text-red-400 mb-1">{resumen.errores.length} fila(s) con problemas</div>
              <div className="text-xs text-neutral-500 max-h-24 overflow-y-auto">
                {resumen.errores.slice(0, 10).map((e, i) => (
                  <div key={i}>{e}</div>
                ))}
              </div>
            </div>
          )}

          {!confirmado && (
            <div className="flex items-center gap-3 pt-1">
              <Button variant="primary" disabled={cargando} onClick={confirmarImportacion}>
                {cargando ? "Importando..." : `Confirmar importación de ${resumen.totalFilas} productos`}
              </Button>
              <Button variant="ghost" onClick={reiniciar}>
                Cancelar
              </Button>
            </div>
          )}
          {confirmado && (
            <Button variant="secondary" onClick={reiniciar} className="self-start">
              Importar otro archivo
            </Button>
          )}
        </div>
      )}
    </Plegable>
  );
}
