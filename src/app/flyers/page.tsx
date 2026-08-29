"use client";

import { ChangeEvent, useCallback, useEffect, useRef, useState } from "react";
import Button from "@/components/ui/Button";
import Card from "@/components/ui/Card";

type Flyer = { id: number; imagen: string; createdAt: string };
type Rol = "DUENIO" | "CAJERO" | "MOZO";

async function comprimirImagen(archivo: File): Promise<string> {
  if (!archivo.type.startsWith("image/")) throw new Error("Elegí solamente archivos de imagen");

  const url = URL.createObjectURL(archivo);
  try {
    const imagen = new Image();
    await new Promise<void>((resolve, reject) => {
      imagen.onload = () => resolve();
      imagen.onerror = () => reject(new Error("No se pudo leer la imagen"));
      imagen.src = url;
    });

    const escala = Math.min(1, 1600 / Math.max(imagen.naturalWidth, imagen.naturalHeight));
    const canvas = document.createElement("canvas");
    canvas.width = Math.max(1, Math.round(imagen.naturalWidth * escala));
    canvas.height = Math.max(1, Math.round(imagen.naturalHeight * escala));
    const contexto = canvas.getContext("2d");
    if (!contexto) throw new Error("No se pudo procesar la imagen");
    contexto.drawImage(imagen, 0, 0, canvas.width, canvas.height);
    return canvas.toDataURL("image/webp", 0.82);
  } finally {
    URL.revokeObjectURL(url);
  }
}

export default function FlyersPage() {
  const [flyers, setFlyers] = useState<Flyer[]>([]);
  const [rol, setRol] = useState<Rol | null>(null);
  const [cargando, setCargando] = useState(true);
  const [subiendo, setSubiendo] = useState(false);
  const [error, setError] = useState("");
  const [abierto, setAbierto] = useState<number | null>(null);
  const inicioToque = useRef<{ x: number; y: number } | null>(null);

  const cambiarFlyer = useCallback((direccion: -1 | 1) => {
    if (abierto === null || flyers.length < 2) return;
    const indice = flyers.findIndex((flyer) => flyer.id === abierto);
    const siguiente = (indice + direccion + flyers.length) % flyers.length;
    setAbierto(flyers[siguiente].id);
  }, [abierto, flyers]);

  async function cargar() {
    const [flyersRes, usuarioRes] = await Promise.all([
      fetch("/api/flyers", { cache: "no-store" }),
      fetch("/api/auth/me", { cache: "no-store" }),
    ]);
    if (!flyersRes.ok) throw new Error("No se pudieron cargar los flyers");
    setFlyers(await flyersRes.json());
    if (usuarioRes.ok) setRol((await usuarioRes.json()).rol);
  }

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- carga inicial desde la API
    cargar()
      .catch((err) => setError(err instanceof Error ? err.message : "No se pudieron cargar los flyers"))
      .finally(() => setCargando(false));
  }, []);

  useEffect(() => {
    if (abierto === null) return;
    const navegarConTeclado = (evento: KeyboardEvent) => {
      if (evento.key === "Escape") setAbierto(null);
      if (evento.key === "ArrowLeft") cambiarFlyer(-1);
      if (evento.key === "ArrowRight") cambiarFlyer(1);
    };
    window.addEventListener("keydown", navegarConTeclado);
    return () => window.removeEventListener("keydown", navegarConTeclado);
  }, [abierto, cambiarFlyer]);

  async function subir(evento: ChangeEvent<HTMLInputElement>) {
    const archivos = Array.from(evento.target.files || []);
    evento.target.value = "";
    if (!archivos.length) return;

    setSubiendo(true);
    setError("");
    try {
      for (const archivo of archivos) {
        const imagen = await comprimirImagen(archivo);
        const res = await fetch("/api/flyers", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ imagen }),
        });
        if (!res.ok) {
          const data = await res.json().catch(() => null);
          throw new Error(data?.error || `No se pudo subir ${archivo.name}`);
        }
      }
      await cargar();
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudieron subir las imágenes");
    } finally {
      setSubiendo(false);
    }
  }

  async function eliminar(id: number) {
    if (!confirm("¿Eliminar este flyer?")) return;
    setError("");
    const res = await fetch(`/api/flyers/${id}`, { method: "DELETE" });
    if (!res.ok) {
      const data = await res.json().catch(() => null);
      setError(data?.error || "No se pudo eliminar el flyer");
      return;
    }
    setFlyers((actuales) => actuales.filter((flyer) => flyer.id !== id));
    if (abierto === id) setAbierto(null);
  }

  function terminarDeslizamiento(evento: React.TouchEvent) {
    const inicio = inicioToque.current;
    inicioToque.current = null;
    if (!inicio) return;
    const toque = evento.changedTouches[0];
    const desplazamientoX = toque.clientX - inicio.x;
    const desplazamientoY = toque.clientY - inicio.y;
    if (Math.abs(desplazamientoX) < 45 || Math.abs(desplazamientoX) <= Math.abs(desplazamientoY)) return;
    cambiarFlyer(desplazamientoX < 0 ? 1 : -1);
  }

  const flyerAbierto = flyers.find((flyer) => flyer.id === abierto);
  const indiceAbierto = flyers.findIndex((flyer) => flyer.id === abierto);

  return (
    <div className="mx-auto flex max-w-6xl flex-col gap-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-neutral-900 dark:text-neutral-50">Flyers</h1>
          <p className="mt-1 text-sm text-neutral-500">Promociones listas para mostrar a los clientes.</p>
        </div>
        {rol === "DUENIO" && (
          <label className={`inline-flex cursor-pointer items-center justify-center rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700 ${subiendo ? "pointer-events-none opacity-50" : ""}`}>
            {subiendo ? "Subiendo..." : "Cargar imágenes"}
            <input
              type="file"
              accept="image/png,image/jpeg,image/webp"
              multiple
              className="sr-only"
              disabled={subiendo}
              onChange={subir}
            />
          </label>
        )}
      </div>

      {error && <p className="rounded-lg border border-red-300 bg-red-50 px-3 py-2 text-sm text-red-700 dark:border-red-900 dark:bg-red-950 dark:text-red-200">{error}</p>}

      {cargando ? (
        <p className="text-sm text-neutral-500">Cargando flyers...</p>
      ) : flyers.length === 0 ? (
        <Card className="grid min-h-56 place-items-center p-6 text-center text-neutral-500">
          {rol === "DUENIO" ? "Todavía no cargaste ningún flyer." : "Todavía no hay promociones para mostrar."}
        </Card>
      ) : (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
          {flyers.map((flyer) => (
            <Card key={flyer.id} className="group relative overflow-hidden">
              <button type="button" onClick={() => setAbierto(flyer.id)} className="block w-full bg-neutral-100 dark:bg-neutral-950">
                {/* eslint-disable-next-line @next/next/no-img-element -- imágenes cargadas por el negocio */}
                <img src={flyer.imagen} alt="Flyer promocional" className="aspect-[4/5] w-full object-contain" />
              </button>
              {rol === "DUENIO" && (
                <Button
                  type="button"
                  variant="danger"
                  size="sm"
                  onClick={() => eliminar(flyer.id)}
                  className="absolute right-2 top-2 shadow-lg"
                >
                  Eliminar
                </Button>
              )}
            </Card>
          ))}
        </div>
      )}

      {flyerAbierto && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label="Flyer promocional"
          className="fixed inset-0 z-[200] flex touch-pan-y select-none items-center justify-center bg-black/95 p-3 sm:p-6"
          onClick={() => setAbierto(null)}
          onTouchStart={(evento) => {
            const toque = evento.touches[0];
            inicioToque.current = { x: toque.clientX, y: toque.clientY };
          }}
          onTouchEnd={terminarDeslizamiento}
        >
          <button
            type="button"
            onClick={() => setAbierto(null)}
            className="absolute right-3 top-3 z-10 rounded-full bg-white/15 px-4 py-2 text-xl text-white hover:bg-white/25"
            aria-label="Cerrar"
          >
            ×
          </button>
          {flyers.length > 1 && (
            <>
              <button
                type="button"
                onClick={(evento) => {
                  evento.stopPropagation();
                  cambiarFlyer(-1);
                }}
                className="absolute left-2 top-1/2 z-10 -translate-y-1/2 rounded-full bg-white/15 px-4 py-3 text-2xl text-white hover:bg-white/25 sm:left-5"
                aria-label="Flyer anterior"
              >
                ‹
              </button>
              <button
                type="button"
                onClick={(evento) => {
                  evento.stopPropagation();
                  cambiarFlyer(1);
                }}
                className="absolute right-2 top-1/2 z-10 -translate-y-1/2 rounded-full bg-white/15 px-4 py-3 text-2xl text-white hover:bg-white/25 sm:right-5"
                aria-label="Flyer siguiente"
              >
                ›
              </button>
              <div className="absolute bottom-3 left-1/2 z-10 -translate-x-1/2 rounded-full bg-black/50 px-3 py-1 text-xs text-white">
                {indiceAbierto + 1} / {flyers.length} · Deslizá para cambiar
              </div>
            </>
          )}
          {/* eslint-disable-next-line @next/next/no-img-element -- imagen cargada por el negocio */}
          <img
            src={flyerAbierto.imagen}
            alt="Flyer promocional ampliado"
            className="max-h-full max-w-full object-contain"
            onClick={(evento) => evento.stopPropagation()}
          />
        </div>
      )}
    </div>
  );
}
