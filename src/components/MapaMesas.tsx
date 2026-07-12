"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { formatearMoneda } from "@/lib/formato";

export type MesaMapa = {
  id: number;
  nombre: string;
  estado: "LIBRE" | "OCUPADA";
  posX: number;
  posY: number;
  total: number;
};

const TILE = 70;
const UMBRAL_DRAG = 6;

export default function MapaMesas({ mesas }: { mesas: MesaMapa[] }) {
  const router = useRouter();
  const containerRef = useRef<HTMLDivElement>(null);
  const [posiciones, setPosiciones] = useState<Record<number, { x: number; y: number }>>(() =>
    Object.fromEntries(mesas.map((m) => [m.id, { x: m.posX, y: m.posY }]))
  );
  const drag = useRef<{
    id: number;
    startX: number;
    startY: number;
    origX: number;
    origY: number;
    moved: boolean;
  } | null>(null);

  function onPointerDown(e: React.PointerEvent, mesa: MesaMapa) {
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
    const pos = posiciones[mesa.id] ?? { x: mesa.posX, y: mesa.posY };
    drag.current = {
      id: mesa.id,
      startX: e.clientX,
      startY: e.clientY,
      origX: pos.x,
      origY: pos.y,
      moved: false,
    };
  }

  function onPointerMove(e: React.PointerEvent) {
    if (!drag.current) return;
    const d = drag.current;
    const dx = e.clientX - d.startX;
    const dy = e.clientY - d.startY;
    if (Math.abs(dx) > UMBRAL_DRAG || Math.abs(dy) > UMBRAL_DRAG) {
      d.moved = true;
    }
    if (!d.moved) return;

    const bounds = containerRef.current?.getBoundingClientRect();
    const maxX = bounds ? bounds.width - TILE : 2000;
    const maxY = bounds ? bounds.height - TILE : 2000;
    const x = Math.min(Math.max(0, d.origX + dx), maxX);
    const y = Math.min(Math.max(0, d.origY + dy), maxY);
    setPosiciones((prev) => ({ ...prev, [d.id]: { x, y } }));
  }

  async function onPointerUp(mesa: MesaMapa) {
    const d = drag.current;
    drag.current = null;
    if (!d) return;
    if (!d.moved) {
      router.push(`/mesas/${mesa.id}`);
      return;
    }
    const pos = posiciones[mesa.id];
    await fetch(`/api/mesas/${mesa.id}/posicion`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ posX: pos.x, posY: pos.y }),
    });
  }

  return (
    <div
      ref={containerRef}
      className="relative w-full rounded-xl border border-neutral-800 overflow-hidden"
      style={{
        height: "calc(100vh - 300px)",
        minHeight: 420,
        backgroundImage:
          "linear-gradient(to right, rgba(255,255,255,0.04) 1px, transparent 1px), linear-gradient(to bottom, rgba(255,255,255,0.04) 1px, transparent 1px)",
        backgroundSize: "28px 28px",
        backgroundColor: "#141414",
      }}
    >
      {/* Mostrador: punto de referencia fijo, no se arrastra */}
      <div className="absolute right-3 bottom-3 w-24 h-10 rounded-lg border-2 border-blue-600/70 bg-blue-600/15 flex items-center justify-center">
        <span className="text-[10px] font-bold text-blue-500 tracking-wide">MOSTRADOR</span>
      </div>

      {/* Puerta: línea fija que separa adentro/afuera, ya no se arrastra */}
      <div className="absolute left-0 right-0 border-t-2 border-dashed border-neutral-500" style={{ top: "32%" }}>
        <span className="absolute left-1/2 top-0 -translate-x-1/2 -translate-y-1/2 bg-[#141414] px-3 text-xs font-semibold tracking-widest text-neutral-400">
          PUERTA
        </span>
      </div>

      {mesas.map((mesa) => {
        const pos = posiciones[mesa.id] ?? { x: mesa.posX, y: mesa.posY };
        return (
          <div
            key={mesa.id}
            onPointerDown={(e) => onPointerDown(e, mesa)}
            onPointerMove={onPointerMove}
            onPointerUp={() => onPointerUp(mesa)}
            style={{ left: pos.x, top: pos.y, width: TILE, height: TILE, touchAction: "none" }}
            className={`absolute select-none cursor-grab active:cursor-grabbing rounded-lg border-2 flex flex-col items-center justify-center gap-0 shadow-lg transition-colors p-1 ${
              mesa.estado === "OCUPADA"
                ? "bg-red-500/15 border-red-500/60"
                : "bg-emerald-500/10 border-emerald-500/50"
            }`}
          >
            <span className="text-sm font-bold text-neutral-50 leading-none">{mesa.nombre}</span>
            <span
              className={`text-[10px] font-medium leading-none ${
                mesa.estado === "OCUPADA" ? "text-red-400" : "text-emerald-400"
              }`}
            >
              {mesa.estado === "OCUPADA" ? "Ocupada" : "Libre"}
            </span>
            {mesa.total > 0 && <span className="text-[9px] text-neutral-300 leading-none">${formatearMoneda(mesa.total)}</span>}
          </div>
        );
      })}
    </div>
  );
}
