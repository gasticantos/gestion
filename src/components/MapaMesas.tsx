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
  ancho: number;
  alto: number;
  total: number;
  ticketImpreso?: boolean;
};

const TILE = 70;
const UMBRAL_DRAG = 6;

export default function MapaMesas({ mesas }: { mesas: MesaMapa[] }) {
  const router = useRouter();
  const containerRef = useRef<HTMLDivElement>(null);
  const [posiciones, setPosiciones] = useState<Record<number, { x: number; y: number }>>(() =>
    Object.fromEntries(mesas.map((m) => [m.id, { x: m.posX, y: m.posY }]))
  );
  const [dimensiones, setDimensiones] = useState<Record<number, { w: number; h: number }>>(() =>
    Object.fromEntries(mesas.map((m) => [m.id, { w: m.ancho || TILE, h: m.alto || TILE }]))
  );
  const drag = useRef<{
    id: number;
    startX: number;
    startY: number;
    origX: number;
    origY: number;
    moved: boolean;
    isResize?: boolean;
    corner?: "ne" | "nw" | "se" | "sw";
    origW?: number;
    origH?: number;
    currentW?: number;
    currentH?: number;
  } | null>(null);

  function getCorner(e: React.PointerEvent, mesa: MesaMapa): "ne" | "nw" | "se" | "sw" | null {
    const target = e.currentTarget as HTMLElement;
    const rect = target.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    const threshold = 12;

    const isTop = y < threshold;
    const isBottom = y > rect.height - threshold;
    const isLeft = x < threshold;
    const isRight = x > rect.width - threshold;

    if (isTop && isLeft) return "nw";
    if (isTop && isRight) return "ne";
    if (isBottom && isLeft) return "sw";
    if (isBottom && isRight) return "se";
    return null;
  }

  function onPointerDown(e: React.PointerEvent, mesa: MesaMapa) {
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
    const pos = posiciones[mesa.id] ?? { x: mesa.posX, y: mesa.posY };
    const dim = dimensiones[mesa.id] ?? { w: TILE, h: TILE };
    const corner = getCorner(e, mesa);

    drag.current = {
      id: mesa.id,
      startX: e.clientX,
      startY: e.clientY,
      origX: pos.x,
      origY: pos.y,
      moved: false,
      isResize: corner !== null,
      corner: corner ?? undefined,
      origW: dim.w,
      origH: dim.h,
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

    if (d.isResize && d.corner && d.origW !== undefined && d.origH !== undefined) {
      const minSize = 40;
      let w = d.origW;
      let h = d.origH;

      if (d.corner === "se") {
        w = Math.max(minSize, d.origW + dx);
        h = Math.max(minSize, d.origH + dy);
      } else if (d.corner === "sw") {
        w = Math.max(minSize, d.origW - dx);
        h = Math.max(minSize, d.origH + dy);
      } else if (d.corner === "ne") {
        w = Math.max(minSize, d.origW + dx);
        h = Math.max(minSize, d.origH - dy);
      } else if (d.corner === "nw") {
        w = Math.max(minSize, d.origW - dx);
        h = Math.max(minSize, d.origH - dy);
      }

      setDimensiones((prev) => ({ ...prev, [d.id]: { w, h } }));
      d.currentW = w;
      d.currentH = h;
    } else {
      const maxX = bounds ? bounds.width - (dimensiones[d.id]?.w ?? TILE) : 2000;
      const maxY = bounds ? bounds.height - (dimensiones[d.id]?.h ?? TILE) : 2000;
      const x = Math.min(Math.max(0, d.origX + dx), maxX);
      const y = Math.min(Math.max(0, d.origY + dy), maxY);
      setPosiciones((prev) => ({ ...prev, [d.id]: { x, y } }));
    }
  }

  async function onPointerUp(mesa: MesaMapa) {
    const d = drag.current;
    drag.current = null;
    if (!d) return;
    if (!d.moved) {
      router.push(`/mesas/${mesa.id}`);
      return;
    }

    if (d.isResize && d.currentW && d.currentH) {
      await fetch(`/api/mesas/${mesa.id}/dimensiones`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ancho: d.currentW, alto: d.currentH }),
      });
    } else if (!d.isResize) {
      const pos = posiciones[mesa.id];
      await fetch(`/api/mesas/${mesa.id}/posicion`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ posX: pos.x, posY: pos.y }),
      });
    }
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
        const dim = dimensiones[mesa.id] ?? { w: TILE, h: TILE };
        return (
          <div
            key={mesa.id}
            onPointerDown={(e) => onPointerDown(e, mesa)}
            onPointerMove={onPointerMove}
            onPointerUp={() => onPointerUp(mesa)}
            style={{ left: pos.x, top: pos.y, width: dim.w, height: dim.h, touchAction: "none" }}
            className={`absolute select-none cursor-grab active:cursor-grabbing rounded-lg border-2 flex flex-col items-center justify-center gap-0 shadow-lg transition-colors p-1 ${
              mesa.ticketImpreso
                ? "bg-amber-500/15 border-amber-500/60"
                : mesa.estado === "OCUPADA"
                  ? "bg-red-500/15 border-red-500/60"
                  : "bg-emerald-500/10 border-emerald-500/50"
            }`}
          >
            <span className="text-sm font-bold text-neutral-50 leading-none">{mesa.nombre}</span>
            <span
              className={`text-[10px] font-medium leading-none ${
                mesa.ticketImpreso ? "text-amber-400" : mesa.estado === "OCUPADA" ? "text-red-400" : "text-emerald-400"
              }`}
            >
              {mesa.estado === "OCUPADA" ? "Ocupada" : "Libre"}
            </span>
            {mesa.total > 0 && <span className="text-[9px] text-neutral-300 leading-none">${formatearMoneda(mesa.total)}</span>}

            {/* Resize corners */}
            <div className="absolute top-0 left-0 w-3 h-3 cursor-nwse-resize"></div>
            <div className="absolute top-0 right-0 w-3 h-3 cursor-nesw-resize"></div>
            <div className="absolute bottom-0 left-0 w-3 h-3 cursor-nesw-resize"></div>
            <div className="absolute bottom-0 right-0 w-3 h-3 cursor-nwse-resize"></div>
          </div>
        );
      })}
    </div>
  );
}
