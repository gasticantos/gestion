"use client";

import { useEffect, useRef, useState } from "react";

const ROWS = [
  ["1", "2", "3", "4", "5", "6", "7", "8", "9", "0"],
  ["q", "w", "e", "r", "t", "y", "u", "i", "o", "p"],
  ["a", "s", "d", "f", "g", "h", "j", "k", "l"],
  ["z", "x", "c", "v", "b", "n", "m"],
];
const POSICION_KEY = "teclado-productos-posicion";

export default function VirtualKeyboard({
  onInput,
  onCerrar,
}: {
  onInput: (char: string) => void;
  onCerrar?: () => void;
}) {
  const [shift, setShift] = useState(false);
  const [posicion, setPosicion] = useState<{ x: number; y: number } | null>(null);
  const tecladoRef = useRef<HTMLDivElement>(null);

  function limitarPosicion(x: number, y: number) {
    const rect = tecladoRef.current?.getBoundingClientRect();
    const ancho = rect?.width ?? Math.min(430, window.innerWidth - 16);
    const alto = rect?.height ?? 220;
    return {
      x: Math.max(8, Math.min(x, window.innerWidth - ancho - 8)),
      y: Math.max(8, Math.min(y, window.innerHeight - alto - 8)),
    };
  }

  useEffect(() => {
    const guardada = localStorage.getItem(POSICION_KEY);
    let inicial: { x: number; y: number } | null = null;
    if (guardada) {
      try {
        inicial = JSON.parse(guardada);
      } catch {
        localStorage.removeItem(POSICION_KEY);
      }
    }
    const rect = tecladoRef.current?.getBoundingClientRect();
    setPosicion(
      limitarPosicion(
        inicial?.x ?? window.innerWidth - (rect?.width ?? 430) - 12,
        inicial?.y ?? 90
      )
    );

    function ajustarAlCambiarPantalla() {
      setPosicion((actual) => {
        if (!actual) return actual;
        const ajustada = limitarPosicion(actual.x, actual.y);
        localStorage.setItem(POSICION_KEY, JSON.stringify(ajustada));
        return ajustada;
      });
    }
    window.addEventListener("resize", ajustarAlCambiarPantalla);
    return () => window.removeEventListener("resize", ajustarAlCambiarPantalla);
    // Se calcula una sola vez al abrir el teclado.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function comenzarArrastre(e: React.PointerEvent<HTMLDivElement>) {
    e.preventDefault();
    const rect = tecladoRef.current?.getBoundingClientRect();
    if (!rect) return;
    const diferenciaX = e.clientX - rect.left;
    const diferenciaY = e.clientY - rect.top;

    function mover(evento: PointerEvent) {
      setPosicion(limitarPosicion(evento.clientX - diferenciaX, evento.clientY - diferenciaY));
    }
    function terminar(evento: PointerEvent) {
      const final = limitarPosicion(evento.clientX - diferenciaX, evento.clientY - diferenciaY);
      setPosicion(final);
      localStorage.setItem(POSICION_KEY, JSON.stringify(final));
      window.removeEventListener("pointermove", mover);
      window.removeEventListener("pointerup", terminar);
      window.removeEventListener("pointercancel", terminar);
    }
    window.addEventListener("pointermove", mover);
    window.addEventListener("pointerup", terminar);
    window.addEventListener("pointercancel", terminar);
  }

  const handleKey = (key: string) => {
    if (key === "SHIFT") {
      setShift(!shift);
      return;
    }
    if (key === "BACKSPACE") {
      onInput("\b");
      return;
    }
    if (key === "SPACE") {
      onInput(" ");
      return;
    }
    if (key === "ENTER") {
      onInput("\n");
      setShift(false);
      return;
    }
    onInput(shift ? key.toUpperCase() : key);
    setShift(false);
  };

  return (
    <div
      ref={tecladoRef}
      className="fixed z-[100] w-[min(430px,calc(100vw-16px))] bg-neutral-900 border border-neutral-700 rounded-lg p-1 gap-1 flex flex-col text-[11px] shadow-2xl"
      style={posicion ? { left: posicion.x, top: posicion.y } : { right: 12, top: 90 }}
    >
      <div
        onPointerDown={comenzarArrastre}
        className="flex items-center justify-between px-2 py-1 rounded bg-neutral-800 text-neutral-400 cursor-move touch-none select-none"
      >
        <span>Arrastrá para mover</span>
        {onCerrar && (
          <button type="button" onPointerDown={(e) => { e.stopPropagation(); e.preventDefault(); onCerrar(); }} className="px-2 py-0.5 text-neutral-300">
            Cerrar
          </button>
        )}
      </div>
      {ROWS.map((row, idx) => (
        <div key={idx} className="flex gap-0.5 justify-center">
          {row.map((key) => (
            <button
              key={key}
              type="button"
              onPointerDown={(e) => {
                e.preventDefault();
                handleKey(key);
              }}
              className="px-1 py-1.5 bg-neutral-800 hover:bg-neutral-700 border border-neutral-700 rounded font-medium text-neutral-100 active:bg-blue-600 transition-colors flex-1 min-h-8"
              style={{
                minWidth: "auto",
                flex: "1 1 auto",
              }}
            >
              {key}
            </button>
          ))}
        </div>
      ))}
      <div className="flex gap-0.5 justify-center">
        <button
          type="button"
          onPointerDown={(e) => {
            e.preventDefault();
            handleKey("SHIFT");
          }}
          className={`px-2 py-1.5 border border-neutral-700 rounded font-medium transition-colors flex-1 min-h-8 ${
            shift
              ? "bg-blue-600 text-white border-blue-600"
              : "bg-neutral-800 hover:bg-neutral-700 text-neutral-100"
          }`}
        >
          ⇧
        </button>
        <button
          type="button"
          onPointerDown={(e) => {
            e.preventDefault();
            handleKey("SPACE");
          }}
          className="flex-[3] px-2 py-1.5 bg-neutral-800 hover:bg-neutral-700 border border-neutral-700 rounded font-medium text-neutral-100 active:bg-blue-600 transition-colors min-h-8"
        >
          Espacio
        </button>
        <button
          type="button"
          onPointerDown={(e) => {
            e.preventDefault();
            handleKey("BACKSPACE");
          }}
          className="flex-1 px-2 py-1.5 bg-red-600/20 hover:bg-red-600/30 border border-red-600/50 rounded font-medium text-red-400 active:bg-red-600 transition-colors min-h-8"
        >
          ←
        </button>
        <button
          type="button"
          onPointerDown={(e) => {
            e.preventDefault();
            handleKey("ENTER");
          }}
          className="flex-1 px-2 py-1.5 bg-blue-600 hover:bg-blue-700 border border-blue-600 rounded font-medium text-white active:bg-blue-800 transition-colors min-h-8"
        >
          ↵
        </button>
      </div>
    </div>
  );
}
